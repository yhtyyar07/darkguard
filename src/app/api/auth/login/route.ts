import { NextRequest, NextResponse } from "next/server";
import {
  validateAdminCredentials,
  generateToken,
  isAdminAuthConfigured,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    if (!isAdminAuthConfigured()) {
      return NextResponse.json(
        { error: "Admin credentials and a strong JWT_SECRET must be configured" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password required" },
        { status: 400 }
      );
    }

    const isValid = await validateAdminCredentials(username, password);

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = generateToken(username);

    return NextResponse.json(
      {
        success: true,
        token,
        username,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
