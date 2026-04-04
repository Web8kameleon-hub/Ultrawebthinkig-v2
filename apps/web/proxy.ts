/**
 * Clisonix Cloud - Authentication Proxy
 * Protects routes using Auth.js authentication
 */

import { auth } from "@/lib/auth/core";
import {
  createHoneypotHeaders,
  createSecurityHeaders,
  generateNonce,
  getSecurityOptionsFromEnv,
} from "@/lib/security/security-headers";
import {
  BLOCKED_PROBE_PATTERNS,
  DEFENSE_CONFIG,
  DISALLOWED_METHODS,
  matchesPathPrefix,
} from "@/lib/security/defense-config";
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
  /^\/privacy(\/.*)?$/,
  /^\/ads\.txt$/,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
  /^\/sitemap-0\.xml$/,
  /^\/modules$/,
  /^\/modules\/(curiosity-ocean|web-reader|archive|social-intelligence|specialized-chat|aviation-weather|eeg-analysis|neural-synthesis|nanogrid-zeiss|kloud-bridge|weather-dashboard)(\/.*)?$/,
  /^\/(zurich|debate|landing|about-us|pricing|why-clisonix|platform|security|company|developers|status|health)(\/.*)?$/,
];

function isPublicRoute(pathname: string) {
  return publicRoutePatterns.some((pattern) => pattern.test(pathname));
}

function sameOrigin(
  req: Parameters<Parameters<typeof auth>[0]>[0],
  candidate: string | null,
) {
  if (!candidate) return true;

  try {
    return new URL(candidate).origin === req.nextUrl.origin;
  } catch {
    return false;
  }
}

function applySecurityHeaders(
  req: Parameters<Parameters<typeof auth>[0]>[0],
  response: NextResponse,
  isStrictPath: boolean,
  isStaticPath: boolean,
  nonce: string,
) {
  const headers = createSecurityHeaders({
    ...getSecurityOptionsFromEnv(),
    nonce,
  });

  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  response.headers.set(
    "X-Defense-Profile",
    isStrictPath ? "strict" : isStaticPath ? "static" : "default",
  );

  if (isStrictPath) {
    const honeypotHeaders = createHoneypotHeaders();
    for (const [key, value] of Object.entries(honeypotHeaders)) {
      response.headers.set(key, value);
    }
  }

  return response;
}

function deniedResponse(
  req: Parameters<Parameters<typeof auth>[0]>[0],
  status: number,
  reason: string,
  isStrictPath = false,
  isStaticPath = false,
) {
  const nonce = generateNonce();
  const response = NextResponse.json(
    {
      error: reason,
      status,
      timestamp: new Date().toISOString(),
    },
    { status },
  );

  response.headers.set("X-Defense-Action", "blocked");
  return applySecurityHeaders(req, response, isStrictPath, isStaticPath, nonce);
}

export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  const method = req.method.toUpperCase();
  const isStrictPath = matchesPathPrefix(pathname, DEFENSE_CONFIG.paths.strict);
  const isStaticPath = matchesPathPrefix(pathname, DEFENSE_CONFIG.paths.static);
  const host = req.headers.get("host")?.toLowerCase().split(":")[0] ?? "";

  if (host === "clisonix.com") {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.protocol = "https";
    redirectUrl.host = "www.clisonix.com";

    const response = NextResponse.redirect(redirectUrl, 308);
    return applySecurityHeaders(
      req,
      response,
      isStrictPath,
      isStaticPath,
      generateNonce(),
    );
  }

  if (DISALLOWED_METHODS.has(method)) {
    return deniedResponse(
      req,
      405,
      "method_not_allowed",
      isStrictPath,
      isStaticPath,
    );
  }

  if (BLOCKED_PROBE_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return deniedResponse(
      req,
      403,
      "probe_blocked",
      isStrictPath,
      isStaticPath,
    );
  }

  if (isStrictPath && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");
    const fetchSite = req.headers.get("sec-fetch-site");

    if (
      fetchSite === "cross-site" ||
      !sameOrigin(req, origin) ||
      !sameOrigin(req, referer)
    ) {
      return deniedResponse(
        req,
        403,
        "cross_site_blocked",
        isStrictPath,
        isStaticPath,
      );
    }
  }

  const nonce = generateNonce();
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);

  if (pathname.startsWith("/api/auth") || isPublicRoute(pathname)) {
    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    return applySecurityHeaders(
      req,
      response,
      isStrictPath,
      isStaticPath,
      nonce,
    );
  }

  if (!req.auth?.user && !pathname.startsWith("/api")) {
    const signInUrl = new URL("/sign-in", req.url);
    const response = NextResponse.redirect(signInUrl);
    return applySecurityHeaders(
      req,
      response,
      isStrictPath,
      isStaticPath,
      nonce,
    );
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  return applySecurityHeaders(req, response, isStrictPath, isStaticPath, nonce);
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
