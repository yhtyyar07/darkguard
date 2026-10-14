import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { verifyRequestToken } from "@/lib/auth";

const defaultPreferences = { accent: "cyan", density: "comfortable" } as const;
const accents = new Set(["cyan", "violet", "teal", "amber"]);
const densities = new Set(["comfortable", "compact"]);

export async function GET(request: NextRequest) {
  if (!verifyRequestToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const storedSettings = await db.query.settings.findMany();
    const byKey = new Map(storedSettings.map((setting) => [setting.key, setting.value]));
    const accent = byKey.get("dashboard_accent");
    const density = byKey.get("dashboard_density");

    return NextResponse.json({
      accent: accent && accents.has(accent) ? accent : defaultPreferences.accent,
      density: density && densities.has(density) ? density : defaultPreferences.density,
    });
  } catch (error) {
    console.error("Settings fetch error:", error);
    return NextResponse.json({ error: "Could not load settings" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!verifyRequestToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { accent, density } = body;
    if (!accents.has(accent) || !densities.has(density)) {
      return NextResponse.json({ error: "Invalid appearance preferences" }, { status: 400 });
    }

    const now = new Date();
    for (const [key, value] of [
      ["dashboard_accent", accent],
      ["dashboard_density", density],
    ]) {
      await db
        .insert(settings)
        .values({ key, value, type: "string", updatedAt: now })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value, updatedAt: now },
        });
    }

    return NextResponse.json({ success: true, accent, density });
  } catch (error) {
    console.error("Settings update error:", error);
    return NextResponse.json({ error: "Could not save settings" }, { status: 500 });
  }
}