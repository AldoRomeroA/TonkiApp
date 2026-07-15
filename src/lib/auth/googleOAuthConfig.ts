export const GOOGLE_PROVIDER = "google";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

export const GOOGLE_OAUTH_SCOPES = "openid email profile";

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

function looksLikeLocalUri(uri: string): boolean {
  return (
    uri.includes("localhost") ||
    uri.includes("127.0.0.1") ||
    uri.includes("0.0.0.0") ||
    uri.includes("[::]")
  );
}

function resolveRedirectUri(): string | null {
  const isProd = process.env.NODE_ENV === "production";
  const explicit = process.env.GOOGLE_REDIRECT_URI?.trim();

  if (explicit) {
    // Never send users to localhost from a production deploy (Hostinger .env mistake).
    if (isProd && looksLikeLocalUri(explicit)) return null;
    return explicit;
  }

  const appUrl =
    process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) return null;

  try {
    const origin = new URL(appUrl).origin;
    if (looksLikeLocalUri(origin) && isProd) return null;
    if (
      origin.includes("0.0.0.0") ||
      origin.includes("127.0.0.1") ||
      origin.includes("[::]")
    ) {
      return null;
    }
    return `${origin}/api/auth/google/callback`;
  } catch {
    return null;
  }
}

export function getGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = resolveRedirectUri();

  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}
