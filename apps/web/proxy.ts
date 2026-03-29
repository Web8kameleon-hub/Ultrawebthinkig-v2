/**
 * Clisonix Cloud - Authentication Proxy
 * Protects routes using Auth.js authentication
 */

import { auth } from "@/lib/auth/core";
import { NextResponse } from "next/server";

const publicRoutePatterns = [
  /^\/$/,
  /^\/sign-in(\/.*)?$/,
  /^\/sign-up(\/.*)?$/,
  /^\/blog(\/.*)?$/,
  /^\/faq(\/.*)?$/,
  /^\/docs(\/.*)?$/,
  /^\/news(\/.*)?$/,
  /^\/terms(\/.*)?$/,
  /^\/ads\.txt$/,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
  /^\/sitemap-0\.xml$/,
  /^\/modules$/,
  /^\/modules\/(curiosity-ocean|web-reader|archive|social-intelligence|specialized-chat|aviation-weather|eeg-analysis|neural-synthesis|nanogrid-zeiss|weather-dashboard)(\/.*)?$/,
  /^\/(zurich|debate|landing|about-us|pricing|why-clisonix|platform|security|company|developers|status|health)(\/.*)?$/,
];

function isPublicRoute(pathname: string) {
  return publicRoutePatterns.some((pattern) => pattern.test(pathname));
}

export default auth((req) => {
  if (isPublicRoute(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (!req.auth?.user && !req.nextUrl.pathname.startsWith("/api")) {
    const signInUrl = new URL("/sign-in", req.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
