import type { NextConfig } from "next";

// Security headers applied to every response. These cover the items a CASA
// Tier 2 / OWASP-style scan checks for: HSTS, MIME-sniffing, clickjacking,
// referrer leakage, feature policy, and a content security policy.
//
// NOTE: the CSP allows 'unsafe-inline' (required by Next.js' inline hydration
// scripts and by the sandboxed srcdoc iframe that renders email bodies) and
// img-src https:/data: so inline email images render. Verify email rendering
// in the Communications view after any CSP change.
const ContentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.googleapis.com https://oauth2.googleapis.com",
  "frame-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

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
  { key: "Content-Security-Policy", value: ContentSecurityPolicy },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
