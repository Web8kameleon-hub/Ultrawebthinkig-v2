"use client";

/**
 * AdSenseSlot — Google AdSense ad unit component
 *
 * Usage:
 *   <AdSenseSlot slot="1234567890" format="auto" />
 *
 * The publisher ID is read from NEXT_PUBLIC_GOOGLE_ADSENSE_ID env var.
 * Nothing renders if:
 *   - Publisher ID is not configured
 *   - User has declined consent
 *   - Ad blocker suppresses the ins element (silent)
 */

import { useEffect, useRef, useState } from "react";

const CONSENT_KEY = "clisonix_ads_consent_v1";

function getConsent(): "accepted" | "declined" | "unknown" {
  if (typeof window === "undefined") return "unknown";
  const v = localStorage.getItem(CONSENT_KEY);
  return v === "accepted" || v === "declined" ? v : "unknown";
}

type AdFormat = "auto" | "fluid" | "rectangle" | "vertical" | "horizontal";

interface AdSenseSlotProps {
  /** AdSense ad unit slot ID (numeric string from Google) */
  slot: string;
  format?: AdFormat;
  /** Override CSS width / height for fixed-size placements */
  style?: React.CSSProperties;
  /** Responsive auto-sizing (default: true) */
  responsive?: boolean;
  className?: string;
}

export default function AdSenseSlot({
  slot,
  format = "auto",
  style,
  responsive = true,
  className,
}: AdSenseSlotProps) {
  const publisherId = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID ?? "";
  const insRef = useRef<HTMLModElement | null>(null);
  const [consent, setConsent] = useState<"accepted" | "declined" | "unknown">("unknown");
  const [pushed, setPushed] = useState(false);

  useEffect(() => {
    setConsent(getConsent());
  }, []);

  useEffect(() => {
    if (!publisherId || consent !== "accepted" || pushed) return;

    // Push ad after a tick so the DOM is ready
    const timer = setTimeout(() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
        setPushed(true);
      } catch {
        /* ad blocker or network error — fail silently */
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [publisherId, consent, pushed]);

  // Don't render if no publisher ID or user declined
  if (!publisherId || consent === "declined") return null;

  // Render placeholder while waiting for consent decision
  if (consent === "unknown") return null;

  return (
    <div
      className={className}
      style={{ display: "block", textAlign: "center", overflow: "hidden", ...style }}
    >
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={publisherId}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? "true" : "false"}
      />
    </div>
  );
}
