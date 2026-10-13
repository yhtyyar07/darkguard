import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sublinks, logs, users as usersTable } from "@/db/schema";
import { verifyRequestToken } from "@/lib/auth";
import { SubscriptionParser, type ParsedServer } from "@/lib/subscription-parser";
import { syncUserToFirebase } from "@/lib/firebase";
import { eq, desc } from "drizzle-orm";
import axios from "axios";

/**
 * Get all sublinks (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const payload = verifyRequestToken(request);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allSublinks = await db.query.sublinks.findMany({
      orderBy: desc(sublinks.createdAt),
    });

    return NextResponse.json({
      success: true,
      sublinks: allSublinks,
      count: allSublinks.length,
    });
  } catch (error) {
    console.error("Sublinks fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Add new sublink (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const payload = verifyRequestToken(request);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, url } = body;

    if (!name || !url) {
      return NextResponse.json(
        { error: "Name and URL required" },
        { status: 400 }
      );
    }

    // Fetch and parse subscription
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          "User-Agent": "DarkGuard/1.0",
        },
      });

      const data = response.data;
      const dataString =
        typeof data === "string" ? data : JSON.stringify(data);

      // Detect format
      let format = "raw";
      if (
        dataString.match(/^[A-Za-z0-9+/=]+$/) &&
        dataString.length % 4 === 0
      ) {
        format = "base64";
      }

      // Parse servers
      const servers = await SubscriptionParser.parseSubscription(
        dataString
      );

      // Extract headers info
      const headers = {
        "subscription-userinfo": response.headers["subscription-userinfo"],
        expires: response.headers["expires"],
      };

      // Create sublink
      const result = await db
        .insert(sublinks)
        .values({
          name,
          url,
          format,
          status: "active",
          servers: servers as any,
          serverCount: servers.length,
          headers: headers as any,
          lastRefreshed: new Date(),
        })
        .returning();

      if (result.length === 0) {
        return NextResponse.json(
          { error: "Failed to create sublink" },
          { status: 500 }
        );
      }

      const newSublink = result[0];

      // Log the action
      await db.insert(logs).values({
        level: "success",
        category: "sublink_added",
        message: `Sublink '${name}' added with ${servers.length} servers`,
        sublinkId: newSublink.id,
        metadata: { format, serverCount: servers.length },
      });

      return NextResponse.json(
        {
          success: true,
          sublink: newSublink,
        },
        { status: 201 }
      );
    } catch (fetchError) {
      console.error("Failed to fetch sublink URL:", fetchError);

      await db.insert(logs).values({
        level: "error",
        category: "sublink_fetch_failed",
        message: `Failed to fetch sublink '${name}': ${String(fetchError)}`,
        metadata: { url },
      });

      return NextResponse.json(
        { error: "Failed to fetch subscription URL" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Sublink creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!verifyRequestToken(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sublinkId = Number(request.nextUrl.searchParams.get("id"));
    if (!Number.isInteger(sublinkId) || sublinkId < 1) {
      return NextResponse.json({ error: "Valid sublink id is required" }, { status: 400 });
    }

    const [sublink] = await db
      .update(sublinks)
      .set({ status: "disabled", updatedAt: new Date() })
      .where(eq(sublinks.id, sublinkId))
      .returning();
    if (!sublink) {
      return NextResponse.json({ error: "Sublink not found" }, { status: 404 });
    }

    const relatedUsers = await db.query.users.findMany();
    const affectedUsers = relatedUsers.filter(
      (user) => Array.isArray(user.sublinkIds) && user.sublinkIds.includes(sublinkId)
    );
    const activeSublinks = await db.query.sublinks.findMany({
      where: eq(sublinks.status, "active"),
    });

    for (const user of affectedUsers) {
      const userServers = activeSublinks
        .filter((item) => (user.sublinkIds as number[]).includes(item.id))
        .flatMap((item) => (Array.isArray(item.servers) ? item.servers : []));
      const base64Data = SubscriptionParser.toBase64(userServers);
      const updatedAt = new Date();
      await db.update(usersTable).set({ base64Data, updatedAt }).where(eq(usersTable.id, user.id));

      if (user.shortUrl && user.expiryDate) {
        await syncUserToFirebase({
          shortUrl: user.shortUrl,
          username: user.username,
          status: user.status as "active" | "disabled" | "expired",
          base64Data,
          updatedAt: updatedAt.toISOString(),
          expiryDate: user.expiryDate.toISOString(),
          requestCount: user.requestCount || 0,
        });
      }
    }

    await db.insert(logs).values({
      level: "warning",
      category: "sublink_disabled",
      message: `Sublink '${sublink.name}' disabled`,
      sublinkId,
      metadata: { affectedUsers: affectedUsers.length },
    });

    return NextResponse.json({ success: true, affectedUsers: affectedUsers.length });
  } catch (error) {
    console.error("Sublink disable error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Refresh all sublinks and regenerate user subscriptions (background job)
 */
export async function PATCH(request: NextRequest) {
  try {
    // A valid admin token or the configured CRON secret is required.
    const cronSecret = request.headers.get("x-cron-secret");
    const configuredCronSecret = process.env.CRON_SECRET;
    const validCronSecret = Boolean(
      configuredCronSecret && cronSecret === configuredCronSecret
    );
    if (!validCronSecret && !verifyRequestToken(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allSublinks = await db.query.sublinks.findMany({
      where: eq(sublinks.status, "active"),
    });

    let updatedCount = 0;
    let affectedUsersSet = new Set<number>();

    for (const sublink of allSublinks) {
      try {
        // Fetch latest data
        const response = await axios.get(sublink.url, {
          timeout: 10000,
          headers: { "User-Agent": "DarkGuard/1.0" },
        });

        const data = response.data;
        const dataString =
          typeof data === "string" ? data : JSON.stringify(data);

        // Parse servers
        const parsedServers = await SubscriptionParser.parseSubscription(
          dataString
        );
        const previousEnabledStates = new Map<string, boolean[]>();
        const existingServers = Array.isArray(sublink.servers)
          ? sublink.servers as ParsedServer[]
          : [];
        for (const existingServer of existingServers) {
          const states = previousEnabledStates.get(existingServer.originalString) || [];
          states.push(existingServer.enabled !== false);
          previousEnabledStates.set(existingServer.originalString, states);
        }
        const seenLines = new Map<string, number>();
        const servers = parsedServers.map((server) => {
          const occurrence = seenLines.get(server.originalString) || 0;
          seenLines.set(server.originalString, occurrence + 1);
          return {
            ...server,
            enabled:
              previousEnabledStates.get(server.originalString)?.[occurrence] ?? true,
          };
        });

        // Update sublink
        await db
          .update(sublinks)
          .set({
            servers: servers as any,
            serverCount: servers.length,
            lastRefreshed: new Date(),
          })
          .where(eq(sublinks.id, sublink.id));

        updatedCount++;

        // Find all users associated with this sublink
        const associatedUsers = await db.query.users.findMany();
        const userIds = associatedUsers
          .filter(
            (u) =>
              Array.isArray(u.sublinkIds) &&
              (u.sublinkIds as number[]).includes(sublink.id)
          )
          .map((u) => u.id);

        userIds.forEach((id) => affectedUsersSet.add(id));
      } catch (error) {
        console.error(`Failed to refresh sublink ${sublink.id}:`, error);
        await db.insert(logs).values({
          level: "error",
          category: "sublink_refresh_failed",
          message: `Failed to refresh sublink '${sublink.name}': ${String(error)}`,
          sublinkId: sublink.id,
        });
      }
    }

    // Regenerate base64 for all affected users
    const affectedUserIds = Array.from(affectedUsersSet);
    for (const userId of affectedUserIds) {
      const user = await db.query.users.findFirst({
        where: eq(usersTable.id, userId),
      });

      if (user && Array.isArray(user.sublinkIds)) {
        // Get all associated sublinks
        const userSublinks = await db.query.sublinks.findMany();
        const selectedSublinks = userSublinks.filter(
          (s) =>
            s.status === "active" &&
            (user.sublinkIds as number[]).includes(s.id)
        );

        // Combine all servers
        let allServers: any[] = [];
        for (const sub of selectedSublinks) {
          if (Array.isArray(sub.servers)) {
            allServers = allServers.concat(sub.servers);
          }
        }

        // Filter enabled servers
        const enabledServers = SubscriptionParser.filterEnabledServers(
          allServers
        );
        const newBase64 = SubscriptionParser.toBase64(enabledServers);

        // Update user
        await db
          .update(usersTable)
          .set({
            base64Data: newBase64,
            updatedAt: new Date(),
          })
          .where(eq(usersTable.id, userId));

        // Sync to Firebase
        if (user.shortUrl) {
          await syncUserToFirebase({
            shortUrl: user.shortUrl,
            username: user.username,
            status: user.status as any,
            base64Data: newBase64,
            updatedAt: new Date().toISOString(),
            expiryDate: user.expiryDate!.toISOString(),
          });
        }
      }
    }

    await db.insert(logs).values({
      level: "success",
      category: "sublink_refresh_complete",
      message: `Refreshed ${updatedCount} sublinks, affected ${affectedUserIds.length} users`,
      metadata: { sublinksUpdated: updatedCount, usersAffected: affectedUserIds.length },
    });

    return NextResponse.json({
      success: true,
      sublinksRefreshed: updatedCount,
      usersAffected: affectedUserIds.length,
    });
  } catch (error) {
    console.error("Sublink refresh error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
