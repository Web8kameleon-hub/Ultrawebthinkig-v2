"use client";

import { SessionProvider } from 'next-auth/react';
import { RequestLogger } from './telemetry/RequestLogger';
import { WebVitalsReporter } from './telemetry/WebVitalsReporter';

export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <RequestLogger />
      <WebVitalsReporter />
      <SessionProvider>
        {children}
      </SessionProvider>
    </>
  );
}
