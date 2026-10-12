import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, sublinks, settings } from "@/db/schema";
import { verifyRequestToken } from "@/lib/auth";
import { sql } from "drizzle-orm";

/**
 * Export all data as JSON (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const payload = verifyRequestToken(request);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [usersData, sublinksData, settingsData] = await Promise.all([
      db.query.users.findMany(),
      db.query.sublinks.findMany(),
      db.query.settings.findMany(),
    ]);

    const exportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      users: usersData,
      sublinks: sublinksData,
      settings: settingsData,
    };

    return NextResponse.json(exportData);
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Import data from JSON (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const payload = verifyRequestToken(request);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();

    if (
      !data ||
      !Array.isArray(data.users) ||
      !Array.isArray(data.sublinks) ||
      (data.settings !== undefined && !Array.isArray(data.settings))
    ) {
      return NextResponse.json(
        { error: "Invalid import format" },
        { status: 400 }
      );
    }

    const validDate = (value: unknown) =>
      typeof value === "string" && Number.isFinite(new Date(value).getTime());
    if (
      !data.users.every(
        (user: any) =>
          user &&
          typeof user.username === "string" &&
          validDate(user.expiryDate) &&
          Array.isArray(user.sublinkIds)
      ) ||
      !data.sublinks.every(
        (sublink: any) =>
          sublink &&
          typeof sublink.name === "string" &&
          typeof sublink.url === "string" &&
          Array.isArray(sublink.servers)
      )
    ) {
      return NextResponse.json(
        { error: "Import contains invalid user or sublink records" },
        { status: 400 }
      );
    }

    await db.transaction(async (tx) => {
      await tx.delete(users);
      await tx.delete(sublinks);
      if (data.settings) await tx.delete(settings);

      if (data.users.length > 0) {
        await tx.insert(users).values(
          data.users.map((user: any) => ({
            ...user,
            createdAt: validDate(user.createdAt) ? new Date(user.createdAt) : new Date(),
            updatedAt: validDate(user.updatedAt) ? new Date(user.updatedAt) : new Date(),
            expiryDate: new Date(user.expiryDate),
            lastRequested: validDate(user.lastRequested) ? new Date(user.lastRequested) : null,
            firebaseSyncedAt: validDate(user.firebaseSyncedAt)
              ? new Date(user.firebaseSyncedAt)
              : null,
          }))
        );
      }

      if (data.sublinks.length > 0) {
        await tx.insert(sublinks).values(
          data.sublinks.map((sublink: any) => ({
            ...sublink,
            createdAt: validDate(sublink.createdAt) ? new Date(sublink.createdAt) : new Date(),
            updatedAt: validDate(sublink.updatedAt) ? new Date(sublink.updatedAt) : new Date(),
            lastRefreshed: validDate(sublink.lastRefreshed)
              ? new Date(sublink.lastRefreshed)
              : null,
            lastRequested: validDate(sublink.lastRequested)
              ? new Date(sublink.lastRequested)
              : null,
            expireDate: validDate(sublink.expireDate) ? new Date(sublink.expireDate) : null,
          }))
        );
      }

      if (data.settings?.length > 0) {
        await tx.insert(settings).values(
          data.settings.map((setting: any) => ({
            ...setting,
            createdAt: validDate(setting.createdAt) ? new Date(setting.createdAt) : new Date(),
            updatedAt: validDate(setting.updatedAt) ? new Date(setting.updatedAt) : new Date(),
          }))
        );
      }

      await tx.execute(sql`
        SELECT setval(
          pg_get_serial_sequence('users', 'id'),
          COALESCE((SELECT MAX(id) FROM users), 1),
          EXISTS (SELECT 1 FROM users)
        )
      `);
      await tx.execute(sql`
        SELECT setval(
          pg_get_serial_sequence('sublinks', 'id'),
          COALESCE((SELECT MAX(id) FROM sublinks), 1),
          EXISTS (SELECT 1 FROM sublinks)
        )
      `);
      await tx.execute(sql`
        SELECT setval(
          pg_get_serial_sequence('settings', 'id'),
          COALESCE((SELECT MAX(id) FROM settings), 1),
          EXISTS (SELECT 1 FROM settings)
        )
      `);
    });
    return NextResponse.json({
      success: true,
      message: "Data imported successfully",
      stats: {
        usersImported: data.users.length,
        sublinksImported: data.sublinks.length,
        settingsImported: data.settings?.length || 0,
      },
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
