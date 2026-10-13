import { NextRequest, NextResponse } from "next/server";
import { verifyRequestToken } from "@/lib/auth";
import { checkFirebaseConnection } from "@/lib/firebase";

export async function GET(request: NextRequest) {
  if (!verifyRequestToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await checkFirebaseConnection();
  return NextResponse.json(status);
}