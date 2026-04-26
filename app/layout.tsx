/**
 * Web8 Root Layout - Real Data Architecture
 * NO artificial metadata, ONLY verified runtime data
 */

import * as React from 'react';
import PerformanceMonitor from '@/components/PerformanceMonitor';
import type { Metadata, Viewport } from 'next';

interface RootLayoutProps {
  children: React.ReactNode;
}

export const metadata: Metadata = {
  metadataBase: new URL('https://ultraweb.ai'),
  title: {
    default: 'UltraWeb AI — AGI-Powered Web8 Platform',
    template: '%s | UltraWeb AI',
  },
  description:
    'UltraWeb AI is an AGI-powered Web8 platform combining neural search, multi-model AI chat, quantum security, medical intelligence, financial AI and real-time IoT monitoring — built by Ledjan Ahmati.',
  keywords: [
    'AGI', 'ASI', 'artificial intelligence', 'Web8', 'neural search',
    'AI chat', 'EuroWeb', 'UltraWeb', 'quantum security', 'medical AI',
    'financial AI', 'IoT', 'NeuroSonix', 'JOAN ASI', 'machine learning',
    'next.js', 'typescript', 'Ledjan Ahmati',
  ],
  authors: [{ name: 'Ledjan Ahmati', url: 'https://ultraweb.ai' }],
  creator: 'Ledjan Ahmati',
  publisher: 'UltraWeb AI',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://ultraweb.ai',
    siteName: 'UltraWeb AI',
    title: 'UltraWeb AI — AGI-Powered Web8 Platform',
    description:
      'UltraWeb AI is an AGI-powered Web8 platform combining neural search, multi-model AI chat, quantum security, medical intelligence and financial AI.',
    images: [
      {
        url: '/favicon.svg',
        width: 512,
        height: 512,
        alt: 'UltraWeb AI Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@EuroWebAI',
    creator: '@EuroWebAI',
    title: 'UltraWeb AI — AGI-Powered Web8 Platform',
    description:
      'AGI-powered Web8 platform: neural search, AI chat, quantum security, medical & financial AI — live at ultraweb.ai',
    images: ['/favicon.svg'],
  },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: '/favicon.svg',
  },
  manifest: '/site.webmanifest',
  alternates: {
    canonical: 'https://ultraweb.ai',
  },
};

export const viewport: Viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
};

// Web8 Dynamic Export - NO default exports
function RootLayout({ children }: RootLayoutProps) {

  return (
    <html lang="en">
      <body className="web8-accelerated" suppressHydrationWarning={true}>
        {/* Web8 Pure Children - NO artificial providers */}
        {children}

        {/* Web8 Performance Monitor - Global System Monitoring */}
        <React.Suspense fallback={null}>
          <PerformanceMonitor />
        </React.Suspense>
      </body>
    </html>
  );
}

// Web8 Dynamic Export - NO default exports (Named export)
export { RootLayout };

// Next.js App Router compatibility requirement
export default RootLayout;
