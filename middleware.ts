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

export default auth((req) => {
  const { nextUrl } = req;
  if (isPublic(nextUrl.pathname)) return;
  if (!req.auth) {
    const url = new URL("/sign-in", nextUrl.origin);
    url.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(url);
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
