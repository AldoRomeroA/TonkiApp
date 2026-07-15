import { NextResponse } from "next/server";

import { getGoogleOAuthConfig } from "src/lib/auth/googleOAuthConfig";
import { getRecentGoogleOAuthFailures } from "src/lib/auth/googleOAuthDebug";
import {
  getPublicAppOrigin,
  isUnusableHost,
} from "src/lib/auth/publicAppOrigin";
import prisma from "src/lib/db";

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

  let dbOk = false;
  let authIdentityTableOk = false;
  let dbError: string | null = null;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
    const rows = await prisma.$queryRaw<Array<{ c: bigint | number }>>`
      SELECT COUNT(*) AS c
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = 'AuthIdentity'
    `;
    const count = Number(rows[0]?.c ?? 0);
    authIdentityTableOk = count > 0;
  } catch (err) {
    dbError =
      err instanceof Error
        ? err.message.replace(/[A-Za-z0-9_-]{40,}/g, "[redacted]").slice(0, 160)
        : "db_error";
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
    dbOk,
    authIdentityTableOk,
    dbError,
    recentFailures: getRecentGoogleOAuthFailures(),
  });
}
