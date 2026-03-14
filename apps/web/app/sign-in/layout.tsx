"use client";

import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
const isClerkConfigured = clerkKey.startsWith("pk_") && !clerkKey.includes("YOUR_CLERK");

export default function SignInLayout({ children }: { children: ReactNode }) {
  if (!isClerkConfigured) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#10b981",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
