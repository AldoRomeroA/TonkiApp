import { NextResponse } from "next/server";

import { logAndRespondAuthInfrastructureError } from "src/lib/api/authRouteCatch";
import {
  buildGoogleAuthorizationUrl,
  generateOAuthSecrets,
  sanitizeOAuthReturnPath,
} from "src/lib/auth/googleOAuth";
import { getGoogleOAuthConfig } from "src/lib/auth/googleOAuthConfig";
import { clearGoogleOAuthCookies } from "src/lib/auth/googleOAuthCookies";
import { createSignedGoogleOAuthState } from "src/lib/auth/googleOAuthState";
import { getPublicAppOrigin } from "src/lib/auth/publicAppOrigin";

/**
 * OAuth cookies are host-only. If the user starts on www.tonki.io but
 * GOOGLE_REDIRECT_URI points at tonki.io, bounce to APP_URL first.
 * (PKCE secrets now live in signed `state`, but session cookies still need
 * the canonical host.)
 */
function redirectToCanonicalHostIfNeeded(req: Request): NextResponse | null {
  // getPublicAppOrigin no longer throws; keep try for safety.
  let publicOrigin: string;
  try {
    publicOrigin = getPublicAppOrigin(req);
  } catch {
    return null;
  }

  const xfHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestHost = (
    xfHost ||
    req.headers.get("host")?.trim() ||
    ""
  ).toLowerCase();
  if (!requestHost) return null;

  const canonicalHost = new URL(publicOrigin).host.toLowerCase();
  if (requestHost === canonicalHost) return null;

  const incoming = new URL(req.url);
  const dest = new URL(
    `${incoming.pathname}${incoming.search}`,
    publicOrigin
  );
  return NextResponse.redirect(dest, 308);
}

export async function GET(req: Request) {
  try {
    const canonical = redirectToCanonicalHostIfNeeded(req);
    if (canonical) return canonical;

    const config = getGoogleOAuthConfig();
    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Google OAuth no está configurado (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL o GOOGLE_REDIRECT_URI)",
        },
        { status: 503 }
      );
    }

    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const { nonce, codeVerifier, codeChallenge } = generateOAuthSecrets();
    const returnTo = sanitizeOAuthReturnPath(from, "user");

    let state: string;
    try {
      state = await createSignedGoogleOAuthState({
        nonce,
        codeVerifier,
        returnTo,
      });
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "AUTH_SECRET debe tener al menos 32 caracteres",
        },
        { status: 503 }
      );
    }

    const authUrl = buildGoogleAuthorizationUrl(config, {
      state,
      nonce,
      codeChallenge,
    });

    const res = NextResponse.redirect(authUrl);
    // Clear any legacy OAuth cookies from older deploys.
    clearGoogleOAuthCookies(res);
    return res;
  } catch (err) {
    const infra = logAndRespondAuthInfrastructureError(
      "[api/auth/google/start]",
      err
    );
    if (infra) return infra;
    return NextResponse.json(
      { success: false, error: "Error al iniciar Google OAuth" },
      { status: 500 }
    );
  }
}
