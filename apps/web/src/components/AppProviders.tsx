"use client";

import { SessionProvider } from 'next-auth/react';
import { RequestLogger } from './telemetry/RequestLogger';
import AdFooterSlot from './ads/AdFooterSlot';
import AdSidebarSlot from './ads/AdSidebarSlot';
import AdSenseScriptLoader from './ads/AdSenseScriptLoader';

export default function AppProviders({
  children,
  isClerkConfigured,
  adsensePublisherId,
}: {
  children: React.ReactNode;
  isClerkConfigured?: boolean;
  adsensePublisherId?: string;
}) {
  return (
    <>
      <RequestLogger />
      {adsensePublisherId ? <AdSenseScriptLoader publisherId={adsensePublisherId} /> : null}
      <SessionProvider>
        {children}
        <AdSidebarSlot />
        <AdFooterSlot />
      </SessionProvider>
    </>
  );
}
