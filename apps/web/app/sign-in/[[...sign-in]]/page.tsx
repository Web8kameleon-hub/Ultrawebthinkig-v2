/**
 * Clisonix Cloud - Sign In Page
 *
 * @author Ledjan Ahmati
 * @copyright 2026 Clisonix Cloud
 */

"use client";

import type { ReactNode } from "react";
import React, { useEffect, useState } from "react";

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
const isClerkConfigured = clerkKey.startsWith('pk_') && !clerkKey.includes('YOUR_CLERK');

type ClerkModule = {
  ClerkProvider: React.ComponentType<{ publishableKey: string; children: ReactNode }>;
  SignIn: React.ComponentType<Record<string, unknown>>;
};

function reportClerkDebug(event: string, payload: Record<string, unknown>) {
  try {
    const body = JSON.stringify({
      event,
      route: "/sign-in",
      source: "sign-in-page",
      timestamp: new Date().toISOString(),
      ...payload,
    });

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/debug/clerk-init", blob);
      return;
    }

    fetch("/api/debug/clerk-init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore logger failures
  }
}

class AuthErrorBoundary extends React.Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    reportClerkDebug("react_error_boundary", {
      message: error?.message ?? "unknown",
      stack: error?.stack ?? "",
      extra: {
        componentStack: info?.componentStack ?? "",
      },
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 text-center">
          <p className="text-gray-200 text-sm">Sign in form is temporarily unavailable in this session.</p>
          <p className="text-gray-400 text-xs mt-2">Please refresh the page and try again.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function SignInPage() {
  const [clerkModule, setClerkModule] = useState<ClerkModule | null>(null);

  if (typeof window !== "undefined") {
    reportClerkDebug("page_render_started", {
      message: "sign-in chunk executed",
      extra: {
        href: window.location.href,
      },
    });
  }

  useEffect(() => {
    reportClerkDebug("page_effect_started", {
      message: "sign-in useEffect started",
    });
    let mounted = true;
    import("@clerk/nextjs")
      .then((mod) => {
        if (!mounted) {
          return;
        }
        setClerkModule({
          ClerkProvider: mod.ClerkProvider as ClerkModule["ClerkProvider"],
          SignIn: mod.SignIn as ClerkModule["SignIn"],
        });
      })
      .catch((error: unknown) => {
        reportClerkDebug("clerk_import_failed", {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack ?? "" : "",
        });
        if (!mounted) {
          return;
        }
        setClerkModule(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const message = event.message || "";
      if (!/clerk|usesession|sign\s?in|clerkprovider/i.test(message)) {
        return;
      }
      reportClerkDebug("window_error", {
        message,
        stack: event.error?.stack ?? "",
        extra: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
        },
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason || "");
      if (!/clerk|usesession|sign\s?in|clerkprovider/i.test(message)) {
        return;
      }
      reportClerkDebug("unhandled_rejection", {
        message,
        stack: reason instanceof Error ? reason.stack ?? "" : "",
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  if (!isClerkConfigured) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Clisonix Cloud</h1>
          <p className="text-gray-400 text-lg">Sign in is currently unavailable. Please contact support.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">C</span>
            </div>
            <span className="text-2xl font-bold text-white">Clisonix Cloud</span>
          </div>
          <p className="text-gray-400">Welcome back! Sign in to continue.</p>
        </div>

        {/* Clerk Sign In */}
        {clerkModule ? (
          <AuthErrorBoundary>
            <clerkModule.ClerkProvider publishableKey={clerkKey}>
              <clerkModule.SignIn
                routing="hash"
                appearance={{
                  elements: {
                    rootBox: "mx-auto",
                    card: "bg-slate-800/50 backdrop-blur-xl border border-slate-700 shadow-2xl",
                    headerTitle: "text-white",
                    headerSubtitle: "text-gray-400",
                    socialButtonsBlockButton: "bg-slate-700 border-slate-600 text-white hover:bg-slate-600",
                    socialButtonsBlockButtonText: "text-white",
                    dividerLine: "bg-slate-600",
                    dividerText: "text-gray-400",
                    formFieldLabel: "text-gray-300",
                    formFieldInput: "bg-slate-700 border-slate-600 text-white placeholder-gray-400",
                    formButtonPrimary: "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700",
                    footerActionLink: "text-purple-400 hover:text-purple-300",
                    identityPreviewText: "text-white",
                    identityPreviewEditButton: "text-purple-400",
                  },
                }}
              />
            </clerkModule.ClerkProvider>
          </AuthErrorBoundary>
        ) : (
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 text-center">
            <p className="text-gray-200 text-sm">Loading sign in...</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-gray-500 text-sm">
            Protected by enterprise-grade security
          </p>
          <div className="flex items-center justify-center gap-4 mt-4 text-gray-600 text-xs">
            <span>🔒 SSL Encrypted</span>
            <span>•</span>
            <span>🛡️ SOC 2 Compliant</span>
            <span>•</span>
            <span>🌍 GDPR Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
}
