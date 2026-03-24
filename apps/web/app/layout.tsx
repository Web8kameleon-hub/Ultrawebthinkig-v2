import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { RequestLogger } from "../src/components/telemetry/RequestLogger";
import AdFooterSlot from "../src/components/ads/AdFooterSlot";
import { getAdsenseConfigStatus } from "../src/lib/ads/config";
import { CONSENT_STATE_CHANGE_EVENT, CONSENT_STORAGE_KEY } from "../src/lib/consent/state";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { DynamicFavicon } from "../src/components/DynamicFavicon";

const adsenseConfig = getAdsenseConfigStatus();
const ADSENSE_PUBLISHER_ID = adsenseConfig.publisherId;
const ADSENSE_REVIEW_MODE = process.env.ADSENSE_REVIEW_MODE === "true";

if (!adsenseConfig.isConfigured) {
  console.warn(
    "[ads] AdSense publisher ID is not configured. Set NEXT_PUBLIC_GOOGLE_ADSENSE_ID or GOOGLE_ADSENSE_PUBLISHER_ID.",
  );
}

const SITE_URL = "https://www.clisonix.com";
const SITE_NAME = "Clisonix";
const SITE_PRODUCT_NAME = "Clisonix Cloud";
const SITE_DESCRIPTION =
  "Official Clisonix neural intelligence platform for AI workflows, EEG analysis, research tools, and real-time analytics.";
const SITE_OG_IMAGE = `${SITE_URL}/icons/icon-512x512.png`;
const SITE_LOGO = `${SITE_URL}/apple-touch-icon.png`;
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "";
const GOOGLE_SITE_VERIFICATION =
  process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ||
  process.env.GOOGLE_SITE_VERIFICATION ||
  undefined;

const CONSENT_MODE_BOOTSTRAP_SCRIPT = `
  (function () {
    if (typeof window === 'undefined') return;

    window.dataLayer = window.dataLayer || [];
    function gtag(){window.dataLayer.push(arguments);}
    window.gtag = window.gtag || gtag;

    function applyConsentMode(consentState) {
      var adsEnabled = !!(consentState && consentState.ads);
      var analyticsEnabled = !!(consentState && consentState.analytics);
      var adPersonalizationEnabled = !!(consentState && consentState.adPersonalization && adsEnabled);

      window.gtag('consent', 'update', {
        ad_storage: adsEnabled ? 'granted' : 'denied',
        analytics_storage: analyticsEnabled ? 'granted' : 'denied',
        ad_user_data: adsEnabled ? 'granted' : 'denied',
        ad_personalization: adPersonalizationEnabled ? 'granted' : 'denied'
      });
    }

    function getStoredConsentState() {
      try {
        var raw = window.localStorage.getItem('${CONSENT_STORAGE_KEY}');
        if (!raw) return null;

        if (raw === 'accepted') {
          return {
            analytics: true,
            ads: true,
            adPersonalization: true
          };
        }

        if (raw === 'declined') {
          return {
            analytics: false,
            ads: false,
            adPersonalization: false
          };
        }

        return JSON.parse(raw);
      } catch (error) {
        return null;
      }
    }

    window.gtag('consent', 'default', {
      ad_storage: 'denied',
      analytics_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      wait_for_update: 500
    });

    var initialConsent = getStoredConsentState();
    if (initialConsent) {
      applyConsentMode(initialConsent);
    }

    window.addEventListener('${CONSENT_STATE_CHANGE_EVENT}', function (event) {
      if (event && event.detail) {
        applyConsentMode(event.detail);
      }
    });

    window.addEventListener('storage', function (event) {
      if (!event || event.key !== '${CONSENT_STORAGE_KEY}') return;
      var nextConsent = getStoredConsentState();
      if (nextConsent) {
        applyConsentMode(nextConsent);
        return;
      }

      window.gtag('consent', 'update', {
        ad_storage: 'denied',
        analytics_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
    });
  })();
`;

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
        <meta charSet="utf-8" />
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
              ...(SUPPORT_EMAIL ? { "email": SUPPORT_EMAIL } : {}),
              "sameAs": [
                "https://github.com/Web8kameleon-hub/clisonix.com"
              ],
              ...(SUPPORT_EMAIL
                ? {
                    "contactPoint": {
                      "@type": "ContactPoint",
                      "contactType": "customer support",
                      "email": SUPPORT_EMAIL,
                      "availableLanguage": ["English", "Albanian"]
                    }
                  }
                : {})
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
        {ADSENSE_PUBLISHER_ID && ADSENSE_REVIEW_MODE && (
          <script
            id="clisonix-adsense-script"
            async
            crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_PUBLISHER_ID}`}
            data-ad-client={ADSENSE_PUBLISHER_ID}
          />
        )}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
        <script
          id="clisonix-consent-mode-bootstrap"
          dangerouslySetInnerHTML={{
            __html: CONSENT_MODE_BOOTSTRAP_SCRIPT,
          }}
        />
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
        <AppProviders isClerkConfigured={isClerkConfigured} adsensePublisherId={ADSENSE_PUBLISHER_ID}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}









