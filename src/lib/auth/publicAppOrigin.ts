/**
 * Public site origin for redirects behind reverse proxies / `0.0.0.0` binds.
 * Prefer APP_URL, then forwarded headers, then Host — never trust bind addresses.
 */

const FALLBACK_PUBLIC_ORIGIN = "https://tonki.io";

export function getPublicAppOrigin(req: Request): string {
  const configured =
    process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  const xfHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const hostHeader = req.headers.get("host")?.trim();
  const host = xfHost || hostHeader;
  const xfProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const fromUrl = new URL(req.url);

  if (configured) {
    try {
      const configuredOrigin = new URL(configured).origin;
      const configuredHost = new URL(configuredOrigin).host;
      // Never honor APP_URL=https://0.0.0.0:3000 (common Hostinger bind mistake).
      if (!isUnusableHost(configuredHost)) {
        // If APP_URL is loopback but the request arrived on a public host
        // (misconfigured Hostinger env), prefer the public host.
        if (
          isLoopbackHost(configuredHost) &&
          host &&
          !isUnusableHost(host) &&
          !isLoopbackHost(host)
        ) {
          const proto =
            xfProto ||
            (host.startsWith("localhost") || host.startsWith("127.")
              ? "http"
              : "https");
          return `${proto}://${host}`;
        }
        return configuredOrigin;
      }
    } catch {
      // ignore invalid APP_URL
    }
  }

  if (host && !isUnusableHost(host)) {
    const proto =
      xfProto ||
      (host.startsWith("localhost") || host.startsWith("127.")
        ? "http"
        : "https");
    return `${proto}://${host}`;
  }

  if (!isUnusableHost(fromUrl.host)) {
    return fromUrl.origin;
  }

  // Hostinger Node often binds 0.0.0.0 without usable Host / APP_URL.
  return FALLBACK_PUBLIC_ORIGIN;
}

/** Bind addresses that must never appear in browser redirects. */
export function isUnusableHost(host: string): boolean {
  const hostname = host.replace(/:\d+$/, "").toLowerCase();
  return (
    hostname === "0.0.0.0" || hostname === "[::]" || hostname === "::"
  );
}

function isLoopbackHost(host: string): boolean {
  const hostname = host.replace(/:\d+$/, "").toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1";
}
