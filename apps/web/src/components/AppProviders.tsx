"use client";

import { ClerkProvider } from '@clerk/nextjs';
import { RequestLogger } from './telemetry/RequestLogger';
import AdFooterSlot from './ads/AdFooterSlot';

export default function AppProviders({ children, isClerkConfigured }: { children: React.ReactNode; isClerkConfigured: boolean }) {
  if (!isClerkConfigured) {
    return (
      <>
        <RequestLogger />
        {children}
        <AdFooterSlot />
      </>
    );
  }

  return (
    <>
      <RequestLogger />
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
