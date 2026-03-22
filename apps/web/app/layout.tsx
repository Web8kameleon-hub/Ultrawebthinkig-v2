import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { RequestLogger } from "../src/components/telemetry/RequestLogger";
import AdFooterSlot from "../src/components/ads/AdFooterSlot";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { DynamicFavicon } from "../src/components/DynamicFavicon";

// Google AdSense publisher ID
// Prefer NEXT_PUBLIC_*; fallback to GOOGLE_ADSENSE_PUBLISHER_ID from server env.
const DEFAULT_ADSENSE_PUBLISHER_ID = "ca-pub-4323173449597062";
const ADSENSE_ID_PATTERN = /^ca-pub-\d{16}$/;

function resolveAdsensePublisherId(raw?: string): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  if (value.includes("XXXXXXXX")) return "";
  if (!ADSENSE_ID_PATTERN.test(value)) return "";
  return value;
}

const ADSENSE_PUBLISHER_ID =
  resolveAdsensePublisherId(process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID) ||
  resolveAdsensePublisherId(process.env.GOOGLE_ADSENSE_PUBLISHER_ID) ||
  DEFAULT_ADSENSE_PUBLISHER_ID;

const SITE_URL = "https://www.clisonix.com";
const SITE_NAME = "Clisonix";
const SITE_PRODUCT_NAME = "Clisonix Cloud";
const SITE_DESCRIPTION =
  "Official Clisonix neural intelligence platform for AI workflows, EEG analysis, research tools, and real-time analytics.";
const SITE_OG_IMAGE = `${SITE_URL}/icons/icon-512x512.png`;
const SITE_LOGO = `${SITE_URL}/apple-touch-icon.png`;
const SUPPORT_EMAIL = "clisonix@pm.me";
const GOOGLE_SITE_VERIFICATION =
  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ||
  process.env.GOOGLE_SITE_VERIFICATION ||
  undefined;

// Check if Clerk is configured with a REAL key (not placeholder)
const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
const isClerkConfigured = clerkKey.startsWith('pk_') && !clerkKey.includes('YOUR_CLERK');

import AppProviders from '../src/components/AppProviders';


const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// 🚀 AGGRESSIVE SEO - Maximum visibility
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Clisonix | Official Neural Intelligence Platform",
    template: "%s | Clisonix"
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "Clisonix", "Clisonix Cloud", "www.clisonix.com", "neural intelligence platform",
    "AI platform", "EEG analysis", "neural synthesis", "research workflows",
    "real-time analytics", "industrial intelligence", "behavioral science", "developer platform"
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_PRODUCT_NAME,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: SITE_PRODUCT_NAME,
    title: 'Clisonix | Official Neural Intelligence Platform',
    description: SITE_DESCRIPTION,
    images: [
      {
        url: SITE_OG_IMAGE,
        width: 512,
        height: 512,
        alt: 'Clisonix neural intelligence platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Clisonix | Official Neural Intelligence Platform',
    description: SITE_DESCRIPTION,
    images: [SITE_OG_IMAGE],
  },
  category: 'Technology',
  verification: GOOGLE_SITE_VERIFICATION ? {
    google: GOOGLE_SITE_VERIFICATION,
  } : undefined,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Schema.org Structured Data for Rich Snippets */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": SITE_NAME,
              "url": SITE_URL,
              "description": SITE_DESCRIPTION,
              "inLanguage": ["en", "sq"],
              "publisher": {
                "@type": "Organization",
                "name": SITE_NAME,
                "url": SITE_URL,
                "logo": SITE_LOGO
              }
            })
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": SITE_PRODUCT_NAME,
              "applicationCategory": "DeveloperApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "description": SITE_DESCRIPTION,
              "url": SITE_URL,
              "author": {
                "@type": "Organization",
                "name": SITE_NAME,
                "url": SITE_URL
              }
            })
          }}
        />
        {/* Organization Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": SITE_NAME,
              "url": SITE_URL,
              "logo": SITE_LOGO,
              "email": SUPPORT_EMAIL,
              "sameAs": [
                "https://github.com/Web8kameleon-hub/clisonix.com"
              ],
              "contactPoint": {
                "@type": "ContactPoint",
                "contactType": "customer support",
                "email": SUPPORT_EMAIL,
                "availableLanguage": ["English", "Albanian"]
              }
            })
          }}
        />
        <meta name="theme-color" content="#6366f1" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Clisonix" />
        {ADSENSE_PUBLISHER_ID && (
          <meta name="google-adsense-account" content={ADSENSE_PUBLISHER_ID} />
        )}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        {/* ── Google AdSense auto-ads ─────────────────────────────────────────
            Rendered only when NEXT_PUBLIC_GOOGLE_ADSENSE_ID is set.
            Auto-ads places units across the site automatically;
            use <AdSenseSlot> for precise in-content placements.
        ─────────────────────────────────────────────────────────────────── */}
        {ADSENSE_PUBLISHER_ID && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`}
            crossOrigin="anonymous"
          />
        )}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                window.addEventListener('load', function () {
                  navigator.serviceWorker.register('/sw-music-studio.js').catch(function () {});
                });
              }
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                if (typeof window === 'undefined') return;

                function report(eventType, payload) {
                  try {
                    var body = JSON.stringify({
                      event: eventType,
                      route: window.location.pathname,
                      source: 'root-layout-global-handler',
                      timestamp: new Date().toISOString(),
                      userAgent: navigator.userAgent,
                      ...payload
                    });

                    if (navigator.sendBeacon) {
                      navigator.sendBeacon('/api/debug/clerk-init', new Blob([body], { type: 'application/json' }));
                      return;
                    }

                    fetch('/api/debug/clerk-init', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: body,
                      keepalive: true
                    }).catch(function () {});
                  } catch (e) {}
                }

                window.addEventListener('error', function (event) {
                  report('global_window_error', {
                    message: event && event.message ? event.message : 'unknown',
                    stack: event && event.error && event.error.stack ? event.error.stack : '',
                    extra: {
                      filename: event && event.filename ? event.filename : '',
                      lineno: event && event.lineno ? event.lineno : 0,
                      colno: event && event.colno ? event.colno : 0
                    }
                  });
                });

                window.addEventListener('unhandledrejection', function (event) {
                  var reason = event ? event.reason : null;
                  report('global_unhandled_rejection', {
                    message: reason && reason.message ? reason.message : String(reason || ''),
                    stack: reason && reason.stack ? reason.stack : ''
                  });
                });
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${inter.variable} antialiased`}
        suppressHydrationWarning
      >
        <AppProviders isClerkConfigured={isClerkConfigured}>{children}</AppProviders>
      </body>
    </html>
  );
}









