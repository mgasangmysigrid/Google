import { NextResponse } from "next/server";

import { auth } from "@/auth";

const PUBLIC_PATTERNS = [
  /^\/sign-in(\/.*)?$/,
  /^\/api\/auth(\/.*)?$/,
  /^\/unsubscribe(\/.*)?$/,
];

function isPublic(pathname: string) {
  return PUBLIC_PATTERNS.some((re) => re.test(pathname));
}

// Per-request strict Content-Security-Policy. Using a fresh nonce on every
// request lets us drop 'unsafe-inline'/'unsafe-eval' from script-src (the weak
// CSP a CASA DAST scan flags) while still allowing Next.js' inline hydration
// scripts, which Next tags with this nonce automatically when it reads it from
// the request header. 'strict-dynamic' lets nonce'd scripts load their deps.
function buildCsp(nonce: string) {
  const isDev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    // 'unsafe-eval' is only needed for React Fast Refresh in dev.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'", // styled-jsx/Tailwind inject inline styles
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.googleapis.com https://oauth2.googleapis.com",
    "frame-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

function withSecurityHeaders(res: NextResponse, nonce: string) {
  res.headers.set("Content-Security-Policy", buildCsp(nonce));
  // Pages and API responses can carry per-user data — never let a shared/proxy
  // cache store or replay them (CASA "Storable but Non-Cacheable" / "Retrieved
  // from Cache" findings). Static assets are excluded by the matcher below, so
  // their long-lived immutable caching is untouched.
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}

export default auth((req) => {
  const { nextUrl } = req;

  // Reject debug HTTP methods on app routes (Cross-Site Tracing / CASA
  // proxy-disclosure hardening).
  if (req.method === "TRACE" || req.method === "TRACK") {
    return new NextResponse(null, { status: 405 });
  }

  const nonce = crypto.randomUUID().replace(/-/g, "");
  // Forward the nonce so Server Components / Next's runtime can stamp inline
  // scripts with it.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  if (!isPublic(nextUrl.pathname) && !req.auth) {
    const url = new URL("/sign-in", nextUrl.origin);
    url.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search);
    return withSecurityHeaders(NextResponse.redirect(url), nonce);
  }

  return withSecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    nonce,
  );
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
