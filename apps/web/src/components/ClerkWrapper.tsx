"use client";

import { ClerkProvider } from "@clerk/nextjs";

export default function ClerkWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: '#10b981',
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
