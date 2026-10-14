import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyRequestToken } from "@/lib/auth";
import { generateShortUrl } from "@/lib/short-url-generator";
import { syncUserToFirebase } from "@/lib/firebase";
import { eq, desc } from "drizzle-orm";
import { sublinks } from "@/db/schema";
import { SubscriptionParser } from "@/lib/subscription-parser";
import { syncUserToGoogleDrive } from "@/lib/google-drive";

/**
 * Get all users (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const payload = verifyRequestToken(request);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allUsers = await db.query.users.findMany({
      orderBy: desc(users.createdAt),
    });

    return NextResponse.json({
      success: true,
      users: allUsers,
      count: allUsers.length,
    });
  } catch (error) {
    console.error("Users fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Create new user (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const payload = verifyRequestToken(request);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { username, expiryDate, sublinkIds = [], notes = "" } = body;

    if (
      typeof username !== "string" ||
      !username.trim() ||
      typeof expiryDate !== "string" ||
      !Number.isFinite(new Date(expiryDate).getTime()) ||
      !Array.isArray(sublinkIds) ||
      sublinkIds.length === 0 ||
      !sublinkIds.every((id: unknown) => Number.isInteger(id) && Number(id) > 0)
    ) {
      return NextResponse.json(
        { error: "Valid username, expiryDate, and at least one sublink are required" },
        { status: 400 }
      );
    }

    const selectedSublinks = sublinkIds.length
      ? await db.query.sublinks.findMany({
          where: eq(sublinks.status, "active"),
        })
      : [];
    const matchingSublinks = selectedSublinks.filter((sublink) =>
      sublinkIds.includes(sublink.id)
    );
    if (matchingSublinks.length !== new Set(sublinkIds).size) {
      return NextResponse.json(
        { error: "One or more selected sublinks are unavailable" },
        { status: 400 }
      );
    }

    const servers = matchingSublinks.flatMap((sublink) =>
      Array.isArray(sublink.servers) ? sublink.servers : []
    );
    const base64Data = SubscriptionParser.toBase64(servers);

    // Generate short URL
    let shortUrl = generateShortUrl();
    let attempts = 0;

    // Ensure uniqueness
    while (attempts < 5) {
      const existing = await db.query.users.findFirst({
        where: eq(users.shortUrl, shortUrl),
      });

      if (!existing) break;
      shortUrl = generateShortUrl();
      attempts++;
    }

    // Create user
    const result = await db
      .insert(users)
      .values({
        username: username.trim(),
        status: "active",
        expiryDate: new Date(expiryDate),
        sublinkIds,
        shortUrl,
        base64Data,
        notes,
      })
      .returning();

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }

    const newUser = result[0];

    // Sync to Firebase
    await syncUserToFirebase({
      shortUrl: newUser.shortUrl!,
      username: newUser.username,
      status: newUser.status as "active" | "disabled" | "expired",
      base64Data: newUser.base64Data || "",
      updatedAt: newUser.updatedAt!.toISOString(),
      expiryDate: newUser.expiryDate!.toISOString(),
    });
    const googleDriveUrl = await syncUserToGoogleDrive(newUser);

    return NextResponse.json(
      {
        success: true,
        user: { ...newUser, googleDriveUrl },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("User creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
