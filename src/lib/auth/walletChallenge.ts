import type { NextResponse } from "next/server";
import { randomBytes } from "crypto";

import { AUTH_CHALLENGE } from "src/lib/auth/constants";

export const WALLET_NONCE_COOKIE = "tonki_wallet_nonce";
export const WALLET_NONCE_MAX_AGE_SEC = 300;

const NONCE_HEX_LEN = 32;

export function generateWalletNonce(): string {
  return randomBytes(NONCE_HEX_LEN / 2).toString("hex");
}

/** Mensaje firmado por el cliente vía Freighter `signMessage`. */
export function buildWalletChallengeMessage(nonce: string): string {
  return `${AUTH_CHALLENGE}\nNonce: ${nonce}`;
}

export function attachWalletNonceCookie(res: NextResponse, nonce: string): void {
  res.cookies.set(WALLET_NONCE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: WALLET_NONCE_MAX_AGE_SEC,
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearWalletNonceCookie(res: NextResponse): void {
  res.cookies.set(WALLET_NONCE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: process.env.NODE_ENV === "production",
  });
}
