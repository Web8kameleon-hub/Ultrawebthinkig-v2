"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getProviders, signIn, useSession } from "next-auth/react";
import { trackEconomy } from "@/lib/economy/track";

export default function SignInPage() {
  const { status } = useSession();
  const searchParams = useSearchParams();
  const [providerState, setProviderState] = useState({ google: false, apple: false });
  const [providersResolved, setProvidersResolved] = useState(false);

  useEffect(() => {
    trackEconomy({
      economy_code: "CTR",
      slot: "auth",
      placement_id: "sign-in-page",
    });

    getProviders()
      .then((providers) => {
        setProviderState({
          google: Boolean(providers?.google),
          apple: Boolean(providers?.apple),
        });
        setProvidersResolved(true);
      })
      .catch(() => {
        setProviderState({ google: false, apple: false });
        setProvidersResolved(true);
      });
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      window.location.href = "/modules";
    }
  }, [status]);

  const authError = searchParams.get("error");
  const authErrorMessage = useMemo(() => {
    if (!authError) return null;
    if (["AccessDenied", "OAuthSignin", "OAuthCallbackError", "CallbackRouteError"].includes(authError)) {
      return "The selected sign-in provider is currently restricted. For Google, switch the OAuth consent screen to External or add the account as a test user. For Apple, verify the Service ID and redirect URL configuration.";
    }
    if (authError === "Configuration") {
      return "Authentication is configured incorrectly. Check the Google/Apple client IDs, secrets, and redirect URLs.";
    }
    return "Sign-in failed. Please try again or contact the administrator.";
  }, [authError]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">C</span>
            </div>
            <span className="text-2xl font-bold text-white">Clisonix Cloud</span>
          </div>
          <p className="text-gray-400">Welcome back! Sign in to continue.</p>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 text-center">
          <div className="space-y-3">
            {providerState.google ? (
              <button
                type="button"
                onClick={() => {
                  trackEconomy({
                    economy_code: "CTR",
                    slot: "auth",
                    placement_id: "google-sign-in",
                  });
                  signIn("google", { callbackUrl: "/modules" });
                }}
                className="w-full rounded-lg bg-white px-4 py-3 font-medium text-black hover:bg-slate-200"
              >
                Continue with Google
              </button>
            ) : null}

            {providerState.apple ? (
              <button
                type="button"
                onClick={() => {
                  trackEconomy({
                    economy_code: "CTR",
                    slot: "auth",
                    placement_id: "apple-sign-in",
                  });
                  signIn("apple", { callbackUrl: "/modules" });
                }}
                className="w-full rounded-lg border border-slate-500 bg-slate-950 px-4 py-3 font-medium text-white hover:bg-slate-900"
              >
                Continue with Apple
              </button>
            ) : null}

            {!providersResolved ? (
              <p className="text-gray-300 text-sm">Loading sign-in options...</p>
            ) : null}

            {providersResolved && !providerState.google && !providerState.apple ? (
              <p className="text-gray-300 text-sm">
                Social sign-in is not configured yet. Add `AUTH_GOOGLE_*` and/or `AUTH_APPLE_*` in production env.
              </p>
            ) : null}
          </div>

          {authErrorMessage ? (
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left text-sm text-amber-100">
              {authErrorMessage}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
