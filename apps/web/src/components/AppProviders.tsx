"use client";

import { useEffect, useState } from 'react';
import { RequestLogger } from './telemetry/RequestLogger';
import AdFooterSlot from './ads/AdFooterSlot';

export default function AppProviders({ children, isClerkConfigured }: { children: React.ReactNode; isClerkConfigured: boolean }) {
  const [ClerkProvider, setClerkProvider] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    if (!isClerkConfigured) return;

    // Dynamically import Clerk on the client to avoid HMR/module-init issues
    import('@clerk/nextjs')
      .then((mod) => {
        if (mounted && mod?.ClerkProvider) {
          setClerkProvider(() => mod.ClerkProvider);
        }
      })
      .catch(() => {
        // ignore import errors in dev; we'll render without Clerk
      });

    return () => {
      mounted = false;
    };
  }, [isClerkConfigured]);

  return (
    <>
      <RequestLogger />
      {ClerkProvider ? (
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
      ) : (
        <>
          {children}
          <AdFooterSlot />
        </>
      )}
    </>
  );
}
