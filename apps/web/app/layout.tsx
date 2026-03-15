import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { RequestLogger } from "../src/components/telemetry/RequestLogger";
import AdFooterSlot from "../src/components/ads/AdFooterSlot";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { DynamicFavicon } from "../src/components/DynamicFavicon";

// Google AdSense publisher ID (set NEXT_PUBLIC_GOOGLE_ADSENSE_ID to enable)
const ADSENSE_PUBLISHER_ID = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID ?? "";

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
  metadataBase: new URL('https://clisonix.com'),
  title: {
    default: "Clisonix Cloud - AI-Powered Industrial Intelligence Platform",
    template: "%s | Clisonix Cloud"
  },
  description: "Clisonix Cloud: The next-generation AI platform for industrial intelligence, behavioral science, and real-time analytics. Transform your data into actionable insights with our advanced machine learning solutions.",
  keywords: [
    "AI platform", "industrial intelligence", "machine learning", "behavioral science",
    "real-time analytics", "cloud computing", "neural networks", "data science",
    "IoT analytics", "predictive analytics", "cognitive computing", "deep learning",
    "automation", "smart manufacturing", "Industry 4.0", "digital transformation",
    "Clisonix", "AGI", "artificial general intelligence"
  ],
  authors: [{ name: "Clisonix", url: "https://clisonix.com" }],
  creator: "Clisonix",
  publisher: "Clisonix Cloud",
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
    url: 'https://clisonix.com',
    siteName: 'Clisonix Cloud',
    title: 'Clisonix Cloud - AI-Powered Industrial Intelligence',
    description: 'Transform your industrial operations with AI-powered analytics, behavioral science insights, and real-time monitoring.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Clisonix Cloud - Industrial AI Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Clisonix Cloud - AI-Powered Industrial Intelligence',
    description: 'Next-generation AI platform for industrial intelligence and behavioral science.',
    images: ['/og-image.png'],
    creator: '@clisonix',
  },
  alternates: {
    canonical: 'https://clisonix.com',
  },
  category: 'Technology',
  verification: {
    google: 'YOUR_GOOGLE_VERIFICATION_CODE', // Add after Google Search Console setup
  },
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
              "@type": "SoftwareApplication",
              "name": "Clisonix Cloud",
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.9",
                "ratingCount": "150"
              },
              "description": "AI-powered industrial intelligence and behavioral science platform",
              "url": "https://clisonix.com",
              "author": {
                "@type": "Organization",
                "name": "Clisonix",
                "url": "https://clisonix.com"
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
              "name": "Clisonix",
              "url": "https://clisonix.com",
              "logo": "https://clisonix.com/logo.png",
              "sameAs": [
                "https://github.com/Web8kameleon-hub/clisonix.com",
                "https://linkedin.com/company/clisonix"
              ],
              "contactPoint": {
                "@type": "ContactPoint",
                "contactType": "customer support",
                "email": "clisonix@pm.me",
                "availableLanguage": ["English", "Albanian"]
              }
            })
          }}
        />
        <link rel="canonical" href="https://clisonix.com" />
        <meta name="theme-color" content="#6366f1" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Clisonix" />
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









