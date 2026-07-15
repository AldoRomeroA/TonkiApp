import { SignJWT, jwtVerify } from "jose";

const OAUTH_STATE_ISS = "tonkiapp";
const OAUTH_STATE_AUD = "tonki-google-oauth";
const OAUTH_STATE_MAX_AGE_SEC = 600;

export type GoogleOAuthStatePayload = {
  nonce: string;
  codeVerifier: string;
  returnTo: string | null;
};

function getSecretKey(): Uint8Array | null {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

/**
 * Packs PKCE + nonce into the OAuth `state` param (signed JWT).
 * Survives Hostinger/CDN cases where Set-Cookie on the Google redirect is dropped.
 */
export async function createSignedGoogleOAuthState(
  payload: GoogleOAuthStatePayload
): Promise<string> {
  const key = getSecretKey();
  if (!key) {
    throw new Error("AUTH_SECRET must be set (min 32 chars) for Google OAuth");
  }

  return new SignJWT({
    nonce: payload.nonce,
    codeVerifier: payload.codeVerifier,
    returnTo: payload.returnTo,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(OAUTH_STATE_ISS)
    .setAudience(OAUTH_STATE_AUD)
    .setIssuedAt()
    .setExpirationTime(`${OAUTH_STATE_MAX_AGE_SEC}s`)
    .sign(key);
}

export async function verifySignedGoogleOAuthState(
  state: string
): Promise<GoogleOAuthStatePayload | null> {
  const key = getSecretKey();
  if (!key) return null;

  try {
    const { payload } = await jwtVerify(state, key, {
      issuer: OAUTH_STATE_ISS,
      audience: OAUTH_STATE_AUD,
    });

    const nonce = typeof payload.nonce === "string" ? payload.nonce.trim() : "";
    const codeVerifier =
      typeof payload.codeVerifier === "string"
        ? payload.codeVerifier.trim()
        : "";
    const returnTo =
      typeof payload.returnTo === "string" && payload.returnTo.trim()
        ? payload.returnTo.trim()
        : null;

    if (!nonce || !codeVerifier) return null;
    return { nonce, codeVerifier, returnTo };
  } catch {
    return null;
  }
}
