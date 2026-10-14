import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyRequestToken } from "@/lib/auth";
import {
  batchSyncUsersToGoogleDrive,
  checkGoogleDriveConnection,
} from "@/lib/google-drive";

export async function GET(request: NextRequest) {
  if (!verifyRequestToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await checkGoogleDriveConnection());
}

export async function POST(request: NextRequest) {
  if (!verifyRequestToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await checkGoogleDriveConnection();
  if (connection.status !== "connected") {
    return NextResponse.json(
      { error: connection.message, status: connection.status },
      { status: 503 }
    );
  }

  try {
    const allUsers = await db.query.users.findMany();
    const synced = await batchSyncUsersToGoogleDrive(allUsers);
    return NextResponse.json({
      success: synced === allUsers.filter((user) => Boolean(user.shortUrl)).length,
      synced,
      total: allUsers.filter((user) => Boolean(user.shortUrl)).length,
    });
  } catch (error) {
    console.error("Google Drive backfill failed:", error);
    return NextResponse.json({ error: "Could not sync Drive subscriptions" }, { status: 500 });
  }
}