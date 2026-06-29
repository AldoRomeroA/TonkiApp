import { NextResponse } from "next/server";

import { logAndRespondAuthInfrastructureError } from "src/lib/api/authRouteCatch";
import {
  buildGoogleAuthorizationUrl,
  generateOAuthSecrets,
  sanitizeOAuthReturnPath,
} from "src/lib/auth/googleOAuth";
import { getGoogleOAuthConfig } from "src/lib/auth/googleOAuthConfig";
import {
  attachGoogleOAuthCookies,
  clearGoogleOAuthCookies,
} from "src/lib/auth/googleOAuthCookies";

export async function GET(req: Request) {
  try {
    const config = getGoogleOAuthConfig();
    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Google OAuth no está configurado (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)",
        },
        { status: 503 }
      );
    }

    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const { state, nonce, codeVerifier, codeChallenge } =
      generateOAuthSecrets();

    const returnTo = sanitizeOAuthReturnPath(from, "user");

    const authUrl = buildGoogleAuthorizationUrl(config, {
      state,
      nonce,
      codeChallenge,
    });

    const res = NextResponse.redirect(authUrl);
    clearGoogleOAuthCookies(res);
    attachGoogleOAuthCookies(res, {
      state,
      nonce,
      codeVerifier,
      returnTo,
    });
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
