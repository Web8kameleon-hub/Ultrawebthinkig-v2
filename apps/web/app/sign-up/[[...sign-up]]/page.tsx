/**
 * Clisonix Cloud - Sign Up Page
 *
 * @author Ledjan Ahmati
 * @copyright 2026 Clisonix Cloud
 */

"use client";
"use client";

import { useEffect, useState } from "react";
import { getProviders, signIn, useSession } from "next-auth/react";
import { trackEconomy } from "@/lib/economy/track";

export default function SignUpPage() {
  const { status } = useSession();
  const [googleConfigured, setGoogleConfigured] = useState(false);

  useEffect(() => {
    getProviders()
      .then((providers) => {
        setGoogleConfigured(Boolean(providers?.google));
      })
      .catch(() => {
        setGoogleConfigured(false);
      });
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      window.location.href = "/modules";
    }
  }, [status]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">C</span>
            </div>
            <span className="text-2xl font-bold text-white">Clisonix Cloud</span>
          </div>
          <p className="text-gray-400">Create your account to get started.</p>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 text-center">
          {googleConfigured ? (
            <button
              type="button"
              onClick={() => {
                trackEconomy({
                  economy_code: "CTA",
                  slot: "auth",
                  placement_id: "google-sign-up",
                });
                signIn("google", { callbackUrl: "/modules" });
              }}
              className="w-full rounded-lg bg-white px-4 py-3 font-medium text-black hover:bg-slate-200"
            >
              Continue with Google
            </button>
          ) : (
            <p className="text-gray-300 text-sm">
              Google sign-up is not configured yet. Add `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` in production env.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
