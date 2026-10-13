import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters");
  }
  return secret;
}

export function isAdminAuthConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_USERNAME &&
      process.env.ADMIN_PASSWORD &&
      process.env.JWT_SECRET &&
      process.env.JWT_SECRET.length >= 32
  );
}

export interface JWTPayload {
  username: string;
  role: "admin";
  iat: number;
  exp: number;
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Compare password with hash
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT token
 */
export function generateToken(username: string): string {
  const payload: Omit<JWTPayload, "iat" | "exp"> = {
    username,
    role: "admin",
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: "24h",
  });
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Validate admin credentials (simple comparison with env vars)
 */
export async function validateAdminCredentials(
  username: string,
  password: string
): Promise<boolean> {
  return isAdminAuthConfigured() &&
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD;
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Verify and extract JWT from request
 */
export function verifyRequestToken(request: Request): JWTPayload | null {
  const authHeader = request.headers.get("authorization");
  const cookieHeader = request.headers.get("cookie") || "";
  const cookieMatch = cookieHeader.match(/(?:^|;\s*)darkguard_session=([^;]+)/);
  const cookieToken = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
  const token = cookieToken || extractToken(authHeader);

  if (!token) {
    return null;
  }

  return verifyToken(token);
}
