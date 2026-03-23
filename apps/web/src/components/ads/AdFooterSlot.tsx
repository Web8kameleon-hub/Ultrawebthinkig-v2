"use client";

import { useEffect, useMemo, useState } from "react";
import {
  acceptAllConsent,
  canRequestAds,
  hasAnsweredConsent,
  readConsentState,
  rejectAllConsent,
  type ConsentState,
} from "../../lib/consent/state";

type AdConfig = {
  enabled: boolean;
  reason: string;
  provider: string;
  slot: string;
  render_mode?: string;
  script_url?: string;
  script_attrs?: Record<string, string>;
  fallback_text?: string;
};

export default function AdFooterSlot() {
  const [consentState, setConsentState] = useState<ConsentState>(readConsentState);
  const [config, setConfig] = useState<AdConfig | null>(null);

  const shouldRequest = useMemo(() => canRequestAds(consentState), [consentState]);
  const hasAnswered = useMemo(() => hasAnsweredConsent(consentState), [consentState]);

  useEffect(() => {
    setConsentState(readConsentState());
  }, []);

  useEffect(() => {
    if (!shouldRequest) {
      return;
    }

    let active = true;
    const run = async () => {
      const response = await fetch(`/api/ads/config?slot=footer&consent=true`, {
        method: "GET",
        cache: "no-store",
      });
      const data = (await response.json()) as AdConfig;
      if (active) {
        setConfig(data);
      }
    };

    run().catch(() => {
      if (active) {
        setConfig({
          enabled: false,
          reason: "client_error",
          provider: "none",
          slot: "footer",
          fallback_text: "Ad unavailable",
        });
      }
    });

    return () => {
      active = false;
    };
  }, [shouldRequest]);

  useEffect(() => {
    if (!config?.enabled || !config.script_url) {
      return;
    }

    const id = `clisonix-ad-slot-${config.slot}`;
    if (document.getElementById(id)) {
      return;
    }

    const script = document.createElement("script");
    script.id = id;
    script.src = config.script_url;
    script.async = true;

    if (config.script_attrs) {
      Object.entries(config.script_attrs).forEach(([k, v]) => {
        script.setAttribute(k, v);
      });
    }

    script.onload = () => {
      fetch("/api/ads/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "impression",
          slot: "footer",
          provider: config.provider,
          placement_id: config.script_attrs?.["data-zone"] || "",
          page: window.location.pathname,
        }),
      }).catch(() => {});
    };

    document.body.appendChild(script);

    return () => {
      // Keep script mounted to avoid duplicate network calls during navigation
    };
  }, [config]);

  const accept = () => {
    try {
      setConsentState(acceptAllConsent());
    } catch {
      setConsentState({
        necessary: true,
        analytics: true,
        ads: true,
        adPersonalization: true,
        decision: "accepted_all",
        updatedAt: new Date().toISOString(),
        version: 2,
      });
    }
  };

  const decline = () => {
    try {
      setConsentState(rejectAllConsent());
    } catch {
      setConsentState({
        necessary: true,
        analytics: false,
        ads: false,
        adPersonalization: false,
        decision: "rejected_all",
        updatedAt: new Date().toISOString(),
        version: 2,
      });
    }
  };

  if (!hasAnswered) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[90] flex justify-center px-2">
        <div className="pointer-events-auto w-[95%] max-w-2xl rounded-xl border border-gray-300 bg-white p-4 shadow-lg">
          <p className="text-sm text-gray-700">
            We use limited advertising to support the platform. You can accept or decline non-essential ads.
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={accept} className="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-700">
              Accept Ads
            </button>
            <button onClick={decline} className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Decline
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!shouldRequest) {
    return null;
  }

  if (!config?.enabled) {
    return null;
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 px-2 py-1 text-center text-xs text-gray-500 backdrop-blur"
      onClick={() => {
        fetch("/api/ads/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "click",
            slot: "footer",
            provider: config.provider,
            placement_id: config.script_attrs?.["data-zone"] || "",
            page: typeof window !== "undefined" ? window.location.pathname : "",
          }),
        }).catch(() => {});
      }}
    >
      Sponsored content
    </div>
  );
}
