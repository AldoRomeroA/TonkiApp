import type { NextConfig } from "next";

const securityHeaders: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

if (process.env.NODE_ENV === "production") {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  });
}

const nextConfig: NextConfig = {
  transpilePackages: ["smart-account-kit", "smart-account-kit-bindings"],
  // Allow other devices on the local network to reach the dev server's
  // internal/HMR endpoints without cross-origin warnings.
  allowedDevOrigins: ["192.168.100.48"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
