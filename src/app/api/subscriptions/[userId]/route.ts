import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyRequestToken } from "@/lib/auth";
import { SubscriptionParser } from "@/lib/subscription-parser";
import { syncUserToFirebase } from "@/lib/firebase";

/**
 * Get user subscription data
 * Handles both dashboard requests (with JWT) and VPN app requests (without JWT)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const userAgent = request.headers.get("user-agent") || "";

    // Check if this is from a VPN app (Hiddify, v2ray, Clash, etc.)
    const isVpnApp =
      /hiddify|v2ray|clash|xray|nekobox|singbox/i.test(userAgent);

    // Public subscription URLs must use an unguessable short code, not sequential IDs.
    if (!/^[a-z]{2}-[a-z]{2}-[a-z]{2}$/.test(userId)) {
      return NextResponse.json(
        { status: "error", message: "Subscription not found" },
        { status: 404 }
      );
    }

    let user = await db.query.users.findFirst({
      where: eq(users.shortUrl, userId),
    });

    if (!user) {
      return NextResponse.json(
        {
          status: "error",
          message: "[SUBSCRIPTION NOT FOUND]",
        },
        {
          status: 404,
          headers: {
            "Content-Disposition": 'attachment; filename="subscription.txt"',
          },
        }
      );
    }

    // Check subscription status
    const now = new Date();
    let statusCode = 200;
    let subscriptionData = user.base64Data || "";
    let statusHeader = "valid";

    if (user.status === "deleted") {
      statusHeader = "[SUBSCRIPTION IS DELETED]";
      subscriptionData = "";
      statusCode = 410;
    } else if (user.status === "disabled") {
      statusHeader = "[SUBSCRIPTION IS DISABLED]";
      subscriptionData = "";
      statusCode = 403;
    } else if (user.expiryDate && user.expiryDate < now) {
      statusHeader = "[SUBSCRIPTION EXPIRED]";
      subscriptionData = "";
      statusCode = 410;
    }

    // Update last requested timestamp if VPN app
    if (isVpnApp && user.id) {
      await db
        .update(users)
        .set({
          lastRequested: new Date(),
          requestCount: (user.requestCount || 0) + 1,
        })
        .where(eq(users.id, user.id));
    }

    const headers = {
      "Content-Type": isVpnApp ? "text/plain; charset=utf-8" : "application/json",
      "Profile-Title": `base64:${Buffer.from("Darkguard Team").toString("base64")}`,
      "Subscription-Userinfo": `upload=0; download=0; total=0; expire=${Math.floor(user.expiryDate?.getTime() / 1000 || 0)}`,
    };

    if (isVpnApp) {
      return new NextResponse(
        statusCode === 200 ? subscriptionData : statusHeader,
        { status: statusCode, headers }
      );
    }

    return NextResponse.json(
      {
        status: statusCode === 200 ? "active" : "inactive",
        subscription: statusHeader,
        data: subscriptionData,
      },
      { status: statusCode, headers }
    );
  } catch (error) {
    console.error("Subscription fetch error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Internal server error",
      },
      { status: 500 }
    );
  }
}

/**
 * Update user subscription (admin only)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  try {
    // Verify JWT token
    const payload = verifyRequestToken(request);
    if (!payload) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userIdNum = parseInt(userId, 10);
    const body = await request.json();

    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, userIdNum),
    });
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updates: Partial<typeof users.$inferInsert> = {};
    if (body.username !== undefined) {
      if (typeof body.username !== "string" || !body.username.trim()) {
        return NextResponse.json({ error: "Invalid username" }, { status: 400 });
      }
      updates.username = body.username.trim();
    }
    if (body.status !== undefined) {
      if (!["active", "disabled", "expired"].includes(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      updates.status = body.status;
    }
    if (body.expiryDate !== undefined) {
      const expiryDate = new Date(body.expiryDate);
      if (!Number.isFinite(expiryDate.getTime())) {
        return NextResponse.json({ error: "Invalid expiryDate" }, { status: 400 });
      }
      updates.expiryDate = expiryDate;
    }
    if (body.notes !== undefined) {
      if (typeof body.notes !== "string") {
        return NextResponse.json({ error: "Invalid notes" }, { status: 400 });
      }
      updates.notes = body.notes;
    }
    if (body.sublinkIds !== undefined) {
      if (
        !Array.isArray(body.sublinkIds) ||
        !body.sublinkIds.every((id: unknown) => Number.isInteger(id) && Number(id) > 0)
      ) {
        return NextResponse.json({ error: "Invalid sublinkIds" }, { status: 400 });
      }
      const availableSublinks = await db.query.sublinks.findMany();
      const selectedSublinks = availableSublinks.filter((sublink) =>
        body.sublinkIds.includes(sublink.id)
      );
      if (selectedSublinks.length !== new Set(body.sublinkIds).size) {
        return NextResponse.json({ error: "Unknown sublink selected" }, { status: 400 });
      }
      updates.sublinkIds = body.sublinkIds;
      updates.base64Data = SubscriptionParser.toBase64(
        selectedSublinks.flatMap((sublink) =>
          Array.isArray(sublink.servers) ? sublink.servers : []
        )
      );
    }

    const result = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userIdNum))
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (result[0].shortUrl && result[0].expiryDate) {
      await syncUserToFirebase({
        shortUrl: result[0].shortUrl,
        username: result[0].username,
        status: result[0].status as "active" | "disabled" | "expired",
        base64Data: result[0].base64Data || "",
        updatedAt: result[0].updatedAt!.toISOString(),
        expiryDate: result[0].expiryDate.toISOString(),
        requestCount: result[0].requestCount || 0,
      });
    }

    return NextResponse.json({
      success: true,
      user: result[0],
    });
  } catch (error) {
    console.error("User update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Delete user subscription (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Verify JWT token
    const payload = verifyRequestToken(request);
    if (!payload) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { userId } = await params;
    const userIdNum = parseInt(userId, 10);

    const existingUser = await db.query.users.findFirst({
      where: eq(users.id, userIdNum),
    });
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Soft delete - mark as deleted
    const result = await db
      .update(users)
      .set({
        status: "deleted",
        updatedAt: new Date(),
      })
      .where(eq(users.id, userIdNum))
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (result[0].shortUrl) {
      await syncUserToFirebase({
        shortUrl: result[0].shortUrl,
        username: result[0].username,
        status: "disabled",
        base64Data: "",
        updatedAt: result[0].updatedAt!.toISOString(),
        expiryDate: result[0].expiryDate!.toISOString(),
        requestCount: result[0].requestCount || 0,
      });
    }

    return NextResponse.json({
      success: true,
      message: "User subscription deleted",
    });
  } catch (error) {
    console.error("User deletion error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
