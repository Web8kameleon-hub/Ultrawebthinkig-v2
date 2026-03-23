"use client";

import { ClerkProvider } from '@clerk/nextjs';
import { RequestLogger } from './telemetry/RequestLogger';
import AdFooterSlot from './ads/AdFooterSlot';
import AdSenseScriptLoader from './ads/AdSenseScriptLoader';

export default function AppProviders({
  children,
  isClerkConfigured,
  adsensePublisherId,
}: {
  children: React.ReactNode;
  isClerkConfigured: boolean;
  adsensePublisherId?: string;
}) {
  const clientClerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
  const isClientClerkConfigured = clientClerkKey.startsWith('pk_') && !clientClerkKey.includes('YOUR_CLERK');
  const shouldEnableClerk = isClerkConfigured || isClientClerkConfigured;

  if (!shouldEnableClerk) {
    return (
      <>
        <RequestLogger />
        {adsensePublisherId ? <AdSenseScriptLoader publisherId={adsensePublisherId} /> : null}
        {children}
        <AdFooterSlot />
      </>
    );
  }

  return (
    <>
      <RequestLogger />
      {adsensePublisherId ? <AdSenseScriptLoader publisherId={adsensePublisherId} /> : null}
      <ClerkProvider
        appearance={{
          variables: {
            colorPrimary: '#10b981',
          },
        }}
      >
        {children}
        <AdFooterSlot />
      </ClerkProvider>
    </>
  );
}
