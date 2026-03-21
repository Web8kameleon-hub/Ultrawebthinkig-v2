"use client";

/**
 * AdSenseSlot — Google AdSense ad unit component
 *
 * Usage:
 *   <AdSenseSlot slot="1234567890" format="auto" />
 *
 * The publisher ID is read from NEXT_PUBLIC_GOOGLE_ADSENSE_ID,
 * with fallback GOOGLE_ADSENSE_PUBLISHER_ID.
 * Nothing renders if:
 *   - Publisher ID is not configured
 *   - User has declined consent
 *   - Ad blocker suppresses the ins element (silent)
 */

import { useEffect, useRef, useState } from "react";

const CONSENT_KEY = "clisonix_ads_consent_v1";
const DEFAULT_ADSENSE_PUBLISHER_ID = "ca-pub-4323173449597062";
const ADSENSE_ID_PATTERN = /^ca-pub-\d{16}$/;

function resolveAdsensePublisherId(raw?: string): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  if (value.includes("XXXXXXXX")) return "";
  if (!ADSENSE_ID_PATTERN.test(value)) return "";
  return value;
}

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
  /** Reserved minimum height to avoid CLS (default: 250px) */
  minHeight?: number;
  className?: string;
}

export default function AdSenseSlot({
  slot,
  format = "auto",
  style,
  responsive = true,
  minHeight = 250,
  className,
}: AdSenseSlotProps) {
  const publisherId =
    resolveAdsensePublisherId(process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID) ||
    resolveAdsensePublisherId(process.env.GOOGLE_ADSENSE_PUBLISHER_ID) ||
    DEFAULT_ADSENSE_PUBLISHER_ID;
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

  return (
    <div
      className={className}
      style={{
        display: "block",
        textAlign: "center",
        overflow: "hidden",
        position: "relative",
        minHeight,
        backgroundColor: "#f9fafb",
        ...style,
      }}
    >
      {!pushed && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#9ca3af",
            fontSize: "12px",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            pointerEvents: "none",
          }}
        >
          Advertisement
        </div>
      )}
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block", position: "relative", zIndex: 1 }}
        data-ad-client={publisherId}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? "true" : "false"}
      />
    </div>
  );
}
