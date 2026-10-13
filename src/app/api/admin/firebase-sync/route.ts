import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyRequestToken } from "@/lib/auth";
import {
  batchSyncUsersToFirebase,
  checkFirebaseConnection,
  type FirebaseUserData,
} from "@/lib/firebase";

export async function POST(request: NextRequest) {
  if (!verifyRequestToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const firebaseStatus = await checkFirebaseConnection();
  if (firebaseStatus.status !== "connected") {
    return NextResponse.json(
      { error: firebaseStatus.message, status: firebaseStatus.status },
      { status: 503 }
    );
  }

  try {
    const allUsers = await db.query.users.findMany();
    const usersToSync: FirebaseUserData[] = allUsers
      .filter((user) => Boolean(user.shortUrl))
      .map((user) => ({
        shortUrl: user.shortUrl!,
        username: user.username,
        status: user.status as FirebaseUserData["status"],
        base64Data: user.base64Data || "",
        updatedAt: user.updatedAt?.toISOString() || new Date().toISOString(),
        expiryDate: user.expiryDate.toISOString(),
        requestCount: user.requestCount || 0,
      }));

    const synced = await batchSyncUsersToFirebase(usersToSync);
    return NextResponse.json({
      success: synced === usersToSync.length,
      synced,
      total: usersToSync.length,
    });
  } catch (error) {
    console.error("Firebase user backfill failed:", error);
    return NextResponse.json(
      { error: "Could not sync existing users" },
      { status: 500 }
    );
  }
}