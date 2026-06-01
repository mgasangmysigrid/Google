import type { NextConfig } from "next";

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
];

const nextConfig: NextConfig = {
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
