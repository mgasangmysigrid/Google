import type { NextConfig } from "next";

// Same-origin only. Overrides the permissive `Access-Control-Allow-Origin: *`
// the CDN injects onto static assets (the CASA "Cross-Domain Misconfiguration"
// finding). Falls back to the production origin when the env var is unset.
const APP_ORIGIN = process.env.NEXT_PUBLIC_BASE_URL ?? "https://app.mysigrid.com";

// Static security headers applied to every response (HSTS, MIME-sniffing,
// clickjacking, referrer leakage, feature policy). The Content-Security-Policy
// is intentionally NOT here — it is generated per-request with a fresh nonce in
// middleware.ts so script-src can avoid 'unsafe-inline'/'unsafe-eval' (the weak
// CSP a CASA Tier 2 DAST scan flags).
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // Opt-in cross-origin isolation: blocks other origins from embedding our
  // resources and counters Spectre-style side channels (CASA "Cross-Origin-
  // Resource-Policy Header Missing" finding).
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // 'credentialless' rather than 'require-corp' (CASA "Cross-Origin-Embedder-
  // Policy Missing" finding). require-corp would BLOCK cross-origin resources
  // without a CORP header — i.e. inbound email images shown in the sandboxed
  // preview iframe, and any external avatars. credentialless loads those public
  // resources without credentials instead of blocking them, so rendering is
  // preserved while the header is present.
  { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
  // Replace the CDN's wildcard CORS with our own origin.
  { key: "Access-Control-Allow-Origin", value: APP_ORIGIN },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  // Suppress `X-Powered-By: Next.js` (CASA framework-disclosure finding).
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Static assets bypass middleware, so the CDN's wildcard CORS lands here
      // untouched — re-apply the header set to override it on those paths too.
      { source: "/_next/static/:path*", headers: securityHeaders },
    ];
  },
};

export default nextConfig;
