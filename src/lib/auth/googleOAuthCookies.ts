import type { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const GOOGLE_OAUTH_STATE_COOKIE = "tonki_google_oauth_state";
export const GOOGLE_OAUTH_NONCE_COOKIE = "tonki_google_oauth_nonce";
export const GOOGLE_OAUTH_CODE_VERIFIER_COOKIE = "tonki_google_oauth_code_verifier";
export const GOOGLE_OAUTH_RETURN_TO_COOKIE = "tonki_google_oauth_return_to";

export const GOOGLE_OAUTH_COOKIE_MAX_AGE_SEC = 600;

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};

export type GoogleOAuthCookiePayload = {
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo: string | null;
};

export async function readGoogleOAuthCookies(): Promise<GoogleOAuthCookiePayload | null> {
  const jar = await cookies();
  const state = jar.get(GOOGLE_OAUTH_STATE_COOKIE)?.value?.trim() ?? "";
  const nonce = jar.get(GOOGLE_OAUTH_NONCE_COOKIE)?.value?.trim() ?? "";
  const codeVerifier =
    jar.get(GOOGLE_OAUTH_CODE_VERIFIER_COOKIE)?.value?.trim() ?? "";
  const returnTo =
    jar.get(GOOGLE_OAUTH_RETURN_TO_COOKIE)?.value?.trim() || null;

  if (!state || !nonce || !codeVerifier) return null;
  return { state, nonce, codeVerifier, returnTo };
}

export function attachGoogleOAuthCookies(
  res: NextResponse,
  payload: GoogleOAuthCookiePayload
): void {
  const opts = { ...cookieBase, maxAge: GOOGLE_OAUTH_COOKIE_MAX_AGE_SEC };
  res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, payload.state, opts);
  res.cookies.set(GOOGLE_OAUTH_NONCE_COOKIE, payload.nonce, opts);
  res.cookies.set(
    GOOGLE_OAUTH_CODE_VERIFIER_COOKIE,
    payload.codeVerifier,
    opts
  );
  if (payload.returnTo) {
    res.cookies.set(GOOGLE_OAUTH_RETURN_TO_COOKIE, payload.returnTo, opts);
  }
}

export function clearGoogleOAuthCookies(res: NextResponse): void {
  const opts = { ...cookieBase, maxAge: 0 };
  res.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", opts);
  res.cookies.set(GOOGLE_OAUTH_NONCE_COOKIE, "", opts);
  res.cookies.set(GOOGLE_OAUTH_CODE_VERIFIER_COOKIE, "", opts);
  res.cookies.set(GOOGLE_OAUTH_RETURN_TO_COOKIE, "", opts);
}
