import { SignJWT, jwtVerify } from "jose";
import type { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const WALLET_PENDING_COOKIE = "tonki_wallet_pending";
export const WALLET_PENDING_JWT_ISS = "tonkiapp";
export const WALLET_PENDING_JWT_AUD = "tonki-wallet-pending";

/** Short window to finish registration after a valid Freighter signature. */
const PENDING_MAX_AGE_SEC = 60 * 15;

function getSecretKey(): Uint8Array | null {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

export type WalletPendingClaims = {
  publicKey: string;
};

export async function createWalletPendingToken(
  publicKey: string
): Promise<string> {
  const key = getSecretKey();
  if (!key) {
    throw new Error("AUTH_SECRET must be set (min 32 chars)");
  }
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(WALLET_PENDING_JWT_ISS)
    .setAudience(WALLET_PENDING_JWT_AUD)
    .setSubject(publicKey)
    .setIssuedAt()
    .setExpirationTime(`${PENDING_MAX_AGE_SEC}s`)
    .sign(key);
}

export async function verifyWalletPendingToken(
  token: string
): Promise<WalletPendingClaims | null> {
  const key = getSecretKey();
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: WALLET_PENDING_JWT_ISS,
      audience: WALLET_PENDING_JWT_AUD,
    });
    const publicKey = typeof payload.sub === "string" ? payload.sub.trim() : "";
    if (!publicKey || publicKey.length < 56) return null;
    return { publicKey };
  } catch {
    return null;
  }
}

export function attachWalletPendingCookie(res: NextResponse, token: string): void {
  res.cookies.set(WALLET_PENDING_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: PENDING_MAX_AGE_SEC,
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearWalletPendingCookie(res: NextResponse): void {
  res.cookies.set(WALLET_PENDING_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function getWalletPendingFromCookies(): Promise<WalletPendingClaims | null> {
  try {
    const store = await cookies();
    const token = store.get(WALLET_PENDING_COOKIE)?.value;
    if (!token) return null;
    return verifyWalletPendingToken(token);
  } catch {
    return null;
  }
}

/** Age in whole years from a calendar birth date (UTC date parts). */
export function ageFromBirthDate(birthDate: Date): number {
  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - birthDate.getUTCMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getUTCDate() < birthDate.getUTCDate())
  ) {
    age -= 1;
  }
  return age;
}

export function defaultNameFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim() || "Usuario";
  const cleaned = local.replace(/[._+-]+/g, " ").trim();
  if (!cleaned) return "Usuario";
  return cleaned.slice(0, 100);
}
