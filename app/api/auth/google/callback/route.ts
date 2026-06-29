import { NextResponse } from "next/server";

import { logAndRespondAuthInfrastructureError } from "src/lib/api/authRouteCatch";
import { findOrCreateUserFromGoogle } from "src/lib/auth/googleAccount";
import {
  exchangeGoogleAuthCode,
  oauthStatesMatch,
  resolvePostGoogleAuthRedirect,
  verifyGoogleIdToken,
} from "src/lib/auth/googleOAuth";
import { getGoogleOAuthConfig } from "src/lib/auth/googleOAuthConfig";
import {
  clearGoogleOAuthCookies,
  readGoogleOAuthCookies,
} from "src/lib/auth/googleOAuthCookies";
import {
  attachSessionCookie,
  createSessionToken,
} from "src/lib/auth/session";
import { normalizeUserRole } from "src/lib/auth/userRole";
import prisma from "src/lib/db";

function redirectToLogin(error: string, requestUrl: string): NextResponse {
  const login = new URL("/login", requestUrl);
  login.searchParams.set("error", error);
  const res = NextResponse.redirect(login);
  clearGoogleOAuthCookies(res);
  return res;
}

export async function GET(req: Request) {
  const requestUrl = req.url;

  try {
    const config = getGoogleOAuthConfig();
    if (!config) {
      return redirectToLogin("google_oauth_not_configured", requestUrl);
    }

    const url = new URL(requestUrl);
    const oauthError = url.searchParams.get("error");
    if (oauthError) {
      const message =
        oauthError === "access_denied"
          ? "google_access_denied"
          : "google_oauth_failed";
      return redirectToLogin(message, requestUrl);
    }

    const code = url.searchParams.get("code")?.trim();
    const state = url.searchParams.get("state")?.trim();
    if (!code || !state) {
      return redirectToLogin("google_oauth_invalid_callback", requestUrl);
    }

    const cookiePayload = await readGoogleOAuthCookies();
    if (!cookiePayload || !oauthStatesMatch(cookiePayload.state, state)) {
      return redirectToLogin("google_oauth_state_mismatch", requestUrl);
    }

    const idToken = await exchangeGoogleAuthCode(
      config,
      code,
      cookiePayload.codeVerifier
    );
    const profile = await verifyGoogleIdToken(
      idToken,
      config,
      cookiePayload.nonce
    );

    const { user } = await findOrCreateUserFromGoogle(profile);

    if (user.status !== "active") {
      return redirectToLogin("account_suspended", requestUrl);
    }

    const role = normalizeUserRole(user.type);
    if (!role) {
      return redirectToLogin("invalid_account_role", requestUrl);
    }

    const smartWallet = await prisma.smartWallet.findFirst({
      where: { user_id: user.user_id },
      select: { wallet_id: true },
    });

    const redirectTo = resolvePostGoogleAuthRedirect(
      role,
      Boolean(smartWallet),
      cookiePayload.returnTo
    );

    let token: string;
    try {
      token = await createSessionToken({ userId: user.user_id, role });
    } catch {
      return redirectToLogin("auth_secret_missing", requestUrl);
    }

    const res = NextResponse.redirect(new URL(redirectTo, requestUrl));
    clearGoogleOAuthCookies(res);
    attachSessionCookie(res, token);
    return res;
  } catch (err) {
    console.error("[api/auth/google/callback]", err);

    const infra = logAndRespondAuthInfrastructureError(
      "[api/auth/google/callback]",
      err
    );
    if (infra) {
      const res = redirectToLogin("google_oauth_infrastructure_error", requestUrl);
      return res;
    }

    return redirectToLogin("google_oauth_failed", requestUrl);
  }
}
