import { SignJWT, jwtVerify } from "jose";
import type { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { UserRole } from "src/types/auth";

export const SESSION_COOKIE_NAME = "tonki_session";

/** Reclamos estándar `jose` para delimitar el uso del token dentro de esta app. */
export const SESSION_JWT_ISS = "tonkiapp";
export const SESSION_JWT_AUD = "tonki-session";

const MAX_AGE_SEC = 60 * 60 * 24 * 7;

function getSecretKey(): Uint8Array | null {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

export type SessionClaims = {
  userId: string;
  role: UserRole;
};

async function decodeToken(token: string): Promise<SessionClaims | null> {
  const key = getSecretKey();
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: SESSION_JWT_ISS,
      audience: SESSION_JWT_AUD,
    });
    const userId = typeof payload.sub === "string" ? payload.sub : null;
    const role =
      payload.role === "admin" || payload.role === "user"
        ? (payload.role as UserRole)
        : null;
    if (!userId || !role) return null;
    return { userId, role };
  } catch {
    return null;
  }
}

export async function verifySessionToken(
  token: string
): Promise<SessionClaims | null> {
  return decodeToken(token);
}

function getTokenFromCookieHeader(request: Request): string | null {
  const raw = request.headers.get("cookie");
  if (!raw) return null;
  const prefix = `${SESSION_COOKIE_NAME}=`;
  for (const part of raw.split(";")) {
    const p = part.trim();
    if (p.startsWith(prefix)) {
      try {
        return decodeURIComponent(p.slice(prefix.length));
      } catch {
        return p.slice(prefix.length);
      }
    }
  }
  return null;
}

export async function verifySession(
  request: Request
): Promise<SessionClaims | null> {
  const token = getTokenFromCookieHeader(request);
  if (!token) return null;
  return decodeToken(token);
}

export async function createSessionToken(payload: {
  userId: string;
  role: UserRole;
}): Promise<string> {
  const key = getSecretKey();
  if (!key) {
    throw new Error("AUTH_SECRET must be set (min 32 chars)");
  }
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(SESSION_JWT_ISS)
    .setAudience(SESSION_JWT_AUD)
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(key);
}

export function attachSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function getSessionFromCookies(): Promise<SessionClaims | null> {
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return decodeToken(token);
  } catch {
    return null;
  }
}

/** Authenticated user id from httpOnly session cookie, or null. */
export async function getSessionUserId(): Promise<string | null> {
  const s = await getSessionFromCookies();
  return s?.userId ?? null;
}
