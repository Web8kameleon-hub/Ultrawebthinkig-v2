/**
 * User Routes Layout
 * 
 * Ensures ClerkProvider wraps all user-authenticated routes
 * This prevents pre-rendering errors when pages use Clerk hooks
 * 
 * @author Ledjan Ahmati
 * @copyright 2026 Clisonix Cloud
 */

// Skip pre-rendering for all user routes
export const dynamic = "force-dynamic";

import { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";

export default function UserLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: '#10b981',
        }
      }}
    >
      {children}
    </ClerkProvider>
  );
}
