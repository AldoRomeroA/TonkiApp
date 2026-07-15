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
import { verifySignedGoogleOAuthState } from "src/lib/auth/googleOAuthState";
import { getPublicAppOrigin } from "src/lib/auth/publicAppOrigin";
import {
  attachSessionCookie,
  createSessionToken,
} from "src/lib/auth/session";
import { normalizeUserRole } from "src/lib/auth/userRole";
import prisma from "src/lib/db";

function redirectToLogin(error: string, origin: string): NextResponse {
  const login = new URL("/login", origin);
  login.searchParams.set("error", error);
  const res = NextResponse.redirect(login);
  clearGoogleOAuthCookies(res);
  return res;
}

/** Maps thrown errors to distinct query codes for diagnosis (safe, no secrets). */
function classifyGoogleCallbackError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("token exchange")) return "google_token_exchange_failed";
  if (msg.includes("nonce")) return "google_nonce_mismatch";
  if (
    msg.includes("missing required claims") ||
    msg.includes("not verified") ||
    msg.includes("JWT") ||
    msg.includes("jose")
  ) {
    return "google_id_token_invalid";
  }
  if (msg.includes("APP_URL")) return "google_oauth_origin_misconfigured";
  return "google_oauth_failed";
}

async function resolveOAuthSession(state: string): Promise<{
  nonce: string;
  codeVerifier: string;
  returnTo: string | null;
} | null> {
  const signed = await verifySignedGoogleOAuthState(state);
  if (signed) return signed;

  // Legacy cookie-based flow (pre signed-state deploy).
  const cookiePayload = await readGoogleOAuthCookies();
  if (cookiePayload && oauthStatesMatch(cookiePayload.state, state)) {
    return {
      nonce: cookiePayload.nonce,
      codeVerifier: cookiePayload.codeVerifier,
      returnTo: cookiePayload.returnTo,
    };
  }

  return null;
}

export async function GET(req: Request) {
  let publicOrigin = getPublicAppOrigin(req);

  // Never bounce users to bind addresses after OAuth (Hostinger 0.0.0.0).
  if (
    publicOrigin.includes("0.0.0.0") ||
    publicOrigin.includes("[::]") ||
    publicOrigin.includes("127.0.0.1")
  ) {
    publicOrigin = "https://tonki.io";
  }

  // #region agent log
  fetch("http://127.0.0.1:7356/ingest/edb52a3e-f5c3-46a6-8fec-77822dd566a2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "255aa1",
    },
    body: JSON.stringify({
      sessionId: "255aa1",
      runId: "pre-fix",
      hypothesisId: "A",
      location: "callback/route.ts:GET:origin",
      message: "Resolved publicOrigin for Google callback",
      data: {
        publicOrigin,
        appUrl: process.env.APP_URL?.trim() || null,
        nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || null,
        host: req.headers.get("host"),
        xfHost: req.headers.get("x-forwarded-host"),
        xfProto: req.headers.get("x-forwarded-proto"),
        reqUrlHost: (() => {
          try {
            return new URL(req.url).host;
          } catch {
            return null;
          }
        })(),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  try {
    const config = getGoogleOAuthConfig();
    if (!config) {
      return redirectToLogin("google_oauth_not_configured", publicOrigin);
    }

    const url = new URL(req.url);
    const oauthError = url.searchParams.get("error");
    if (oauthError) {
      const message =
        oauthError === "access_denied"
          ? "google_access_denied"
          : "google_oauth_failed";
      return redirectToLogin(message, publicOrigin);
    }

    const code = url.searchParams.get("code")?.trim();
    const state = url.searchParams.get("state")?.trim();
    if (!code || !state) {
      // #region agent log
      fetch("http://127.0.0.1:7356/ingest/edb52a3e-f5c3-46a6-8fec-77822dd566a2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "255aa1",
        },
        body: JSON.stringify({
          sessionId: "255aa1",
          runId: "pre-fix",
          hypothesisId: "A",
          location: "callback/route.ts:GET:invalid-callback",
          message: "Redirecting to login due to missing code/state",
          data: { publicOrigin, redirectTarget: new URL("/login", publicOrigin).href },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      return redirectToLogin("google_oauth_invalid_callback", publicOrigin);
    }

    const oauthSession = await resolveOAuthSession(state);
    if (!oauthSession) {
      return redirectToLogin("google_oauth_state_mismatch", publicOrigin);
    }

    const idToken = await exchangeGoogleAuthCode(
      config,
      code,
      oauthSession.codeVerifier
    );
    const profile = await verifyGoogleIdToken(
      idToken,
      config,
      oauthSession.nonce
    );

    const { user } = await findOrCreateUserFromGoogle(profile);

    if (user.status !== "active") {
      return redirectToLogin("account_suspended", publicOrigin);
    }

    const role = normalizeUserRole(user.type);
    if (!role) {
      return redirectToLogin("invalid_account_role", publicOrigin);
    }

    const smartWallet = await prisma.smartWallet.findFirst({
      where: { user_id: user.user_id },
      select: { wallet_id: true },
    });

    const redirectTo = resolvePostGoogleAuthRedirect(
      role,
      Boolean(smartWallet),
      oauthSession.returnTo
    );

    let token: string;
    try {
      token = await createSessionToken({ userId: user.user_id, role });
    } catch {
      return redirectToLogin("auth_secret_missing", publicOrigin);
    }

    const finalUrl = new URL(redirectTo, publicOrigin);
    // #region agent log
    fetch("http://127.0.0.1:7356/ingest/edb52a3e-f5c3-46a6-8fec-77822dd566a2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "255aa1",
      },
      body: JSON.stringify({
        sessionId: "255aa1",
        runId: "pre-fix",
        hypothesisId: "A",
        location: "callback/route.ts:GET:success-redirect",
        message: "Post-Google success redirect",
        data: {
          publicOrigin,
          redirectTo,
          finalHref: finalUrl.href,
          looksLocal: /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(finalUrl.href),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    const res = NextResponse.redirect(finalUrl);
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
      return redirectToLogin("google_oauth_infrastructure_error", publicOrigin);
    }

    return redirectToLogin(classifyGoogleCallbackError(err), publicOrigin);
  }
}
