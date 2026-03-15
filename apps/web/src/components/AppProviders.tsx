"use client";

import { ClerkProvider } from '@clerk/nextjs';
import { RequestLogger } from './telemetry/RequestLogger';
import AdFooterSlot from './ads/AdFooterSlot';

export default function AppProviders({ children, isClerkConfigured }: { children: React.ReactNode; isClerkConfigured: boolean }) {
  const clientClerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
  const isClientClerkConfigured = clientClerkKey.startsWith('pk_') && !clientClerkKey.includes('YOUR_CLERK');
  const shouldEnableClerk = isClerkConfigured || isClientClerkConfigured;

  if (!shouldEnableClerk) {
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
