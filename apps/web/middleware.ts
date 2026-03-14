/**
 * Clisonix Cloud - Authentication Middleware
 * Protects routes using Clerk authentication
 *
 * @author Ledjan Ahmati
 * @copyright 2026 Clisonix Cloud
 */

import { NextRequest, NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import { SUPPORTED_LANGUAGES_72 } from "./src/lib/language_detection_72";

// Check if Clerk is configured with a real key (not placeholder)
const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
const isClerkConfigured =
  clerkKey.startsWith("pk_") && !clerkKey.includes("YOUR_CLERK");

// Public routes that don't require authentication
const publicRoutes = [
  "/",
  "/sign-in",
  "/sign-up",
  "/landing",
  "/about-us",
  "/pricing",
  "/why-clisonix",
  "/platform",
  "/security",
  "/company",
  "/developers",
  "/status",
  "/health",
];

const LANGUAGE_COOKIE_KEY = "clisonix_language";
const LANGUAGE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const SUPPORTED_LANGUAGE_SET = new Set(
  SUPPORTED_LANGUAGES_72.map((languageCode) => languageCode.toLowerCase()),
);

function normalizeLanguage(languageTag?: string | null): string | null {
  if (!languageTag) {
    return null;
  }

  const baseLanguage = languageTag.toLowerCase().split("-")[0];
  return SUPPORTED_LANGUAGE_SET.has(baseLanguage) ? baseLanguage : null;
}

function resolveLanguageFromAcceptLanguage(headerValue: string | null): string {
  if (!headerValue) {
    return "en";
  }

  const candidates = headerValue
    .split(",")
    .map((part) => part.trim().split(";")[0])
    .filter(Boolean);

  for (const candidate of candidates) {
    const normalized = normalizeLanguage(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return "en";
}

// Middleware function
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const existingLanguage = normalizeLanguage(
    request.cookies.get(LANGUAGE_COOKIE_KEY)?.value,
  );
  const inferredLanguage =
    existingLanguage ||
    resolveLanguageFromAcceptLanguage(request.headers.get("accept-language"));

  const withLanguageCookie = (response: NextResponse) => {
    if (!existingLanguage) {
      response.cookies.set(LANGUAGE_COOKIE_KEY, inferredLanguage, {
        path: "/",
        maxAge: LANGUAGE_COOKIE_MAX_AGE_SECONDS,
        sameSite: "lax",
      });
    }
    return response;
  };

  // If Clerk is not configured, allow all routes
  if (!isClerkConfigured) {
    return withLanguageCookie(NextResponse.next());
  }

  // Check if route is public
  const isPublic = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );

  if (isPublic || pathname.startsWith("/api")) {
    return withLanguageCookie(NextResponse.next());
  }

  // For protected routes when Clerk is configured, run Clerk's middleware
  try {
    const clerkResp = await clerkMiddleware()(request as any);
    return withLanguageCookie(clerkResp as NextResponse);
  } catch (err) {
    // If Clerk middleware fails, fallback to default response but keep language cookie
    return withLanguageCookie(NextResponse.next());
  }
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
