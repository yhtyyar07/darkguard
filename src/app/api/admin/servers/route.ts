import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { logs, sublinks, users as usersTable } from "@/db/schema";
import { verifyRequestToken } from "@/lib/auth";
import { SubscriptionParser, type ParsedServer } from "@/lib/subscription-parser";
import { syncUserToFirebase } from "@/lib/firebase";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  if (!verifyRequestToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const allSublinks = await db.query.sublinks.findMany();
    const groups = allSublinks.map((sublink) => ({
      id: sublink.id,
      name: sublink.name,
      status: sublink.status,
      servers: (Array.isArray(sublink.servers) ? sublink.servers : []).map(
        (server, index) => {
          const parsedServer = server as ParsedServer;
          return {
            index,
            name: parsedServer.name || "Unnamed server",
            protocol: parsedServer.protocol || "unknown",
            address: parsedServer.server || "",
            port: parsedServer.port,
            enabled: parsedServer.enabled !== false,
          };
        }
      ),
    }));

    return NextResponse.json({ success: true, groups });
  } catch (error) {
    console.error("Servers fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!verifyRequestToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { sublinkId, serverIndex, enabled } = body;

    if (
      !Number.isInteger(sublinkId) ||
      sublinkId < 1 ||
      !Number.isInteger(serverIndex) ||
      serverIndex < 0 ||
      typeof enabled !== "boolean"
    ) {
      return NextResponse.json({ error: "Invalid server update" }, { status: 400 });
    }

    const sublink = await db.query.sublinks.findFirst({
      where: eq(sublinks.id, sublinkId),
    });
    if (!sublink) {
      return NextResponse.json({ error: "Sublink not found" }, { status: 404 });
    }

    const servers = Array.isArray(sublink.servers)
      ? [...(sublink.servers as ParsedServer[])]
      : [];
    if (!servers[serverIndex]) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }
    servers[serverIndex] = { ...servers[serverIndex], enabled };

    const [allSublinks, allUsers] = await Promise.all([
      db.query.sublinks.findMany(),
      db.query.users.findMany(),
    ]);
    const updatedSublinks = allSublinks.map((item) =>
      item.id === sublinkId ? { ...item, servers } : item
    );
    const affectedUsers = allUsers.filter(
      (user) =>
        Array.isArray(user.sublinkIds) &&
        (user.sublinkIds as number[]).includes(sublinkId)
    );
    const userUpdates = affectedUsers.map((user) => {
      const selectedServers = updatedSublinks
        .filter(
          (item) =>
            item.status === "active" &&
            Array.isArray(user.sublinkIds) &&
            (user.sublinkIds as number[]).includes(item.id)
        )
        .flatMap((item) =>
          Array.isArray(item.id === sublinkId ? servers : item.servers)
            ? (item.id === sublinkId ? servers : item.servers) as ParsedServer[]
            : []
        );

      return {
        user,
        base64Data: SubscriptionParser.toBase64(selectedServers),
      };
    });
    const updatedAt = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(sublinks)
        .set({ servers: servers as any, updatedAt })
        .where(eq(sublinks.id, sublinkId));

      for (const { user, base64Data } of userUpdates) {
        await tx
          .update(usersTable)
          .set({ base64Data, updatedAt })
          .where(eq(usersTable.id, user.id));
      }
    });

    await Promise.allSettled(
      userUpdates.map(({ user, base64Data }) => {
        if (!user.shortUrl || !user.expiryDate) return Promise.resolve();
        return syncUserToFirebase({
          shortUrl: user.shortUrl,
          username: user.username,
          status: user.status as "active" | "disabled" | "expired",
          base64Data,
          updatedAt: updatedAt.toISOString(),
          expiryDate: user.expiryDate.toISOString(),
          requestCount: user.requestCount || 0,
        });
      })
    );

    await db.insert(logs).values({
      level: "success",
      category: enabled ? "server_enabled" : "server_disabled",
      message: `Server '${servers[serverIndex].name}' ${enabled ? "enabled" : "disabled"}`,
      sublinkId,
      metadata: { serverIndex, enabled, affectedUsers: userUpdates.length },
    });

    return NextResponse.json({
      success: true,
      enabled,
      affectedUsers: userUpdates.length,
    });
  } catch (error) {
    console.error("Server update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}