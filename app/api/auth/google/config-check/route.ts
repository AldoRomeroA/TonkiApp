import { NextResponse } from "next/server";

import { getGoogleOAuthConfig } from "src/lib/auth/googleOAuthConfig";
import {
  getPublicAppOrigin,
  isUnusableHost,
} from "src/lib/auth/publicAppOrigin";

/**
 * Safe diagnostics for Hostinger env (no secrets).
 * Open: https://tonki.io/api/auth/google/config-check
 */
export async function GET(req: Request) {
  const config = getGoogleOAuthConfig();
  const appUrl =
    process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim() || null;
  const authSecretLen = process.env.AUTH_SECRET?.trim()?.length ?? 0;
  const publicOrigin = getPublicAppOrigin(req);

  let appUrlHost: string | null = null;
  if (appUrl) {
    try {
      appUrlHost = new URL(appUrl).host;
    } catch {
      appUrlHost = "invalid";
    }
  }

  return NextResponse.json({
    configured: Boolean(config),
    appUrl,
    appUrlLooksUnusable: appUrlHost ? isUnusableHost(appUrlHost) : false,
    publicOrigin,
    publicOriginLooksUnusable: isUnusableHost(new URL(publicOrigin).host),
    redirectUri: config?.redirectUri ?? null,
    redirectLooksLocal: Boolean(
      config?.redirectUri?.includes("localhost") ||
        config?.redirectUri?.includes("127.0.0.1") ||
        config?.redirectUri?.includes("0.0.0.0")
    ),
    authSecretOk: authSecretLen >= 32,
    clientIdSuffix: config?.clientId
      ? config.clientId.slice(-24)
      : null,
  });
}
