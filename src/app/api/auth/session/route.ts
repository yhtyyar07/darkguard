import { NextRequest, NextResponse } from "next/server";
import { verifyRequestToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = verifyRequestToken(request);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    username: session.username,
  });
}