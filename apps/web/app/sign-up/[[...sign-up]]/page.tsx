/**
 * Clisonix Cloud - Sign Up Page
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
  SignUp: React.ComponentType<Record<string, unknown>>;
};

function reportClerkDebug(event: string, payload: Record<string, unknown>) {
  try {
    const body = JSON.stringify({
      event,
      route: "/sign-up",
      source: "sign-up-page",
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
          <p className="text-gray-200 text-sm">Sign up form is temporarily unavailable in this session.</p>
          <p className="text-gray-400 text-xs mt-2">Please refresh the page or open <strong>/sign-in</strong> first.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function SignUpPage() {
  const [clerkModule, setClerkModule] = useState<ClerkModule | null>(null);

  if (typeof window !== "undefined") {
    reportClerkDebug("page_render_started", {
      message: "sign-up chunk executed",
      extra: {
        href: window.location.href,
      },
    });
  }

  useEffect(() => {
    reportClerkDebug("page_effect_started", {
      message: "sign-up useEffect started",
    });
    let mounted = true;
    import("@clerk/nextjs")
      .then((mod) => {
        if (!mounted) {
          return;
        }
        setClerkModule({
          ClerkProvider: mod.ClerkProvider as ClerkModule["ClerkProvider"],
          SignUp: mod.SignUp as ClerkModule["SignUp"],
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
      if (!/clerk|usesession|sign\s?up|clerkprovider/i.test(message)) {
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
      if (!/clerk|usesession|sign\s?up|clerkprovider/i.test(message)) {
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
          <p className="text-gray-400 text-lg">Sign up is currently unavailable. Please contact support.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">C</span>
            </div>
            <span className="text-2xl font-bold text-white">Clisonix Cloud</span>
          </div>
          <p className="text-gray-400">Create your account to get started.</p>
        </div>

        {/* Features Preview */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="text-center">
            <div className="w-10 h-10 mx-auto bg-purple-500/20 rounded-lg flex items-center justify-center mb-2">
              <span className="text-purple-400">🧠</span>
            </div>
            <span className="text-xs text-gray-400">AI Analytics</span>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 mx-auto bg-blue-500/20 rounded-lg flex items-center justify-center mb-2">
              <span className="text-blue-400">📊</span>
            </div>
            <span className="text-xs text-gray-400">Real-time Data</span>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 mx-auto bg-green-500/20 rounded-lg flex items-center justify-center mb-2">
              <span className="text-green-400">🔒</span>
            </div>
            <span className="text-xs text-gray-400">Enterprise Security</span>
          </div>
        </div>

        {/* Clerk Sign Up */}
        {isClerkConfigured && clerkModule ? (
          <AuthErrorBoundary>
            <clerkModule.ClerkProvider publishableKey={clerkKey}>
              <clerkModule.SignUp
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
                    formButtonPrimary: "bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700",
                    footerActionLink: "text-green-400 hover:text-green-300",
                    identityPreviewText: "text-white",
                    identityPreviewEditButton: "text-green-400",
                  },
                }}
              />
            </clerkModule.ClerkProvider>
          </AuthErrorBoundary>
        ) : (
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 text-center">
            <p className="text-gray-200 text-sm">Loading sign up...</p>
          </div>
        )}

        {/* Plan Info */}
        <div className="text-center mt-8 p-4 bg-slate-800/30 rounded-xl border border-slate-700">
          <p className="text-gray-300 text-sm font-medium mb-2">
            🎁 Start with Free Plan
          </p>
          <ul className="text-gray-400 text-xs space-y-1">
            <li>✓ 50 API calls/day</li>
            <li>✓ Basic analytics</li>
            <li>✓ Community support</li>
          </ul>
          <p className="text-purple-400 text-xs mt-3">
            Upgrade anytime for more features →
          </p>
        </div>
      </div>
    </div>
  );
}
