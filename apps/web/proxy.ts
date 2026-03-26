/**
 * Clisonix Cloud - Authentication Proxy
 * Protects routes using Clerk authentication
 *
 * @author Ledjan Ahmati
 * @copyright 2026 Clisonix Cloud
 */

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Check if Clerk is configured with a real key (not placeholder)
const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
const isClerkConfigured = clerkKey.startsWith("pk_") && !clerkKey.includes("YOUR_CLERK");

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/blog(.*)",
  "/faq(.*)",
  "/docs(.*)",
  "/news(.*)",
  "/terms(.*)",
  "/robots.txt",
  "/sitemap.xml",
  "/sitemap-0.xml",
  "/modules",
  "/modules/curiosity-ocean(.*)",
  "/modules/web-reader(.*)",
  "/modules/archive(.*)",
  "/modules/social-intelligence(.*)",
  "/modules/specialized-chat(.*)",
  "/modules/aviation-weather(.*)",
  "/modules/eeg-analysis(.*)",
  "/modules/neural-synthesis(.*)",
  "/modules/nanogrid-zeiss(.*)",
  "/modules/weather-dashboard(.*)",
  "/zurich(.*)",
  "/debate(.*)",
  "/landing(.*)",
  "/about-us(.*)",
  "/pricing(.*)",
  "/why-clisonix(.*)",
  "/platform(.*)",
  "/security(.*)",
  "/company(.*)",
  "/developers(.*)",
  "/status(.*)",
  "/health(.*)",
]);

const middleware = isClerkConfigured
  ? clerkMiddleware(async (auth, req) => {
      if (isPublicRoute(req)) {
        return;
      }

      const { userId } = await auth();
      if (!userId && !req.nextUrl.pathname.startsWith("/api")) {
        await auth.protect();
      }
    })
  : () => NextResponse.next();

export default middleware;

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
