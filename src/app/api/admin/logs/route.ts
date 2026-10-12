import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { logs } from "@/db/schema";
import { verifyRequestToken } from "@/lib/auth";
import { desc, sql } from "drizzle-orm";

/**
 * Get logs (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const payload = verifyRequestToken(request);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "50", 10);

    const pageOffset = (page - 1) * pageSize;

    const allLogs = await db.query.logs.findMany({
      orderBy: desc(logs.createdAt),
      limit: pageSize,
      offset: pageOffset,
    });

    // Get total count
    const countResult = await db.select({ count: sql`COUNT(*)` }).from(logs);
    const total = countResult[0]?.count as number || 0;

    return NextResponse.json({
      success: true,
      logs: allLogs,
      pagination: {
        page,
        pageSize,
        total,
      },
    });
  } catch (error) {
    console.error("Logs fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Clear old logs (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const payload = verifyRequestToken(request);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const days = Number(body.days ?? 7);
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      return NextResponse.json(
        { error: "days must be an integer between 1 and 3650" },
        { status: 400 }
      );
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Delete old logs
    await db.delete(logs).where(sql`${logs.createdAt} < ${cutoffDate}`);

    return NextResponse.json({
      success: true,
      message: `Cleared logs older than ${days} days`,
    });
  } catch (error) {
    console.error("Logs deletion error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
