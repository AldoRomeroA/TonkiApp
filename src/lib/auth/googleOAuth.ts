import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

import {
  GOOGLE_AUTH_URL,
  GOOGLE_JWKS_URL,
  GOOGLE_OAUTH_SCOPES,
  GOOGLE_TOKEN_URL,
  type GoogleOAuthConfig,
} from "src/lib/auth/googleOAuthConfig";
import type { UserRole } from "src/types/auth";

const GOOGLE_JWKS = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

function toBase64Url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function generateOAuthSecrets(): {
  nonce: string;
  codeVerifier: string;
  codeChallenge: string;
} {
  const nonce = toBase64Url(randomBytes(32));
  const codeVerifier = toBase64Url(randomBytes(32));
  const codeChallenge = toBase64Url(
    createHash("sha256").update(codeVerifier).digest()
  );
  return { nonce, codeVerifier, codeChallenge };
}

export function buildGoogleAuthorizationUrl(
  config: GoogleOAuthConfig,
  params: {
    state: string;
    nonce: string;
    codeChallenge: string;
  }
): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_OAUTH_SCOPES);
  url.searchParams.set("state", params.state);
  url.searchParams.set("nonce", params.nonce);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export function oauthStatesMatch(expected: string, received: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type GoogleTokenResponse = {
  id_token?: string;
  access_token?: string;
  error?: string;
  error_description?: string;
};

export async function exchangeGoogleAuthCode(
  config: GoogleOAuthConfig,
  code: string,
  codeVerifier: string
): Promise<string> {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = (await res.json()) as GoogleTokenResponse;
  if (!res.ok || !data.id_token) {
    const detail = data.error_description ?? data.error ?? res.statusText;
    throw new Error(`Google token exchange failed: ${detail}`);
  }

  return data.id_token;
}

export async function verifyGoogleIdToken(
  idToken: string,
  config: GoogleOAuthConfig,
  expectedNonce: string
): Promise<GoogleProfile> {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: config.clientId,
  });

  if (payload.nonce !== expectedNonce) {
    throw new Error("Google ID token nonce mismatch");
  }

  const sub = typeof payload.sub === "string" ? payload.sub : null;
  const email = typeof payload.email === "string" ? payload.email : null;
  const emailVerified = payload.email_verified === true;

  if (!sub || !email) {
    throw new Error("Google ID token missing required claims");
  }
  if (!emailVerified) {
    throw new Error("Google email is not verified");
  }

  return {
    sub,
    email,
    emailVerified,
    name: typeof payload.name === "string" ? payload.name : null,
    picture: typeof payload.picture === "string" ? payload.picture : null,
  };
}

/** Safe post-auth redirect for OAuth callback (server-side). */
export function sanitizeOAuthReturnPath(
  raw: string | null | undefined,
  role: UserRole
): string | null {
  if (!raw?.trim()) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw.trim());
  } catch {
    return null;
  }
  const pathOnly = decoded.split(/[?#]/, 1)[0] ?? "";
  if (
    pathOnly.startsWith("//") ||
    !pathOnly.startsWith("/") ||
    pathOnly === "/login"
  ) {
    return null;
  }
  if (/[\x00-\x1f]/.test(pathOnly)) return null;
  if (!/^\/[-\w./]*$/.test(pathOnly)) return null;

  if (pathOnly.startsWith("/admin")) {
    return role === "admin" ? pathOnly : null;
  }
  if (
    pathOnly.startsWith("/dashboard") ||
    pathOnly.startsWith("/account") ||
    pathOnly.startsWith("/onboarding")
  ) {
    return pathOnly;
  }
  return null;
}

export function resolvePostGoogleAuthRedirect(
  role: UserRole,
  hasSmartWallet: boolean,
  returnTo: string | null
): string {
  if (!hasSmartWallet) return "/onboarding/wallet";
  const safeReturn = sanitizeOAuthReturnPath(returnTo, role);
  if (safeReturn) return safeReturn;
  return role === "admin" ? "/admin/dashboard" : "/dashboard";
}
