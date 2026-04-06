import { NextResponse } from "next/server";
import {
  getAdsenseConfigStatus,
  getAdsenseScriptUrl,
  getAdsenseSlotId,
  isAdsenseAutoAdsEnabled,
  isAdsenseReviewMode,
  type AdSlotName,
} from "../../../../src/lib/ads/config";

const isDev = process.env.NODE_ENV === "development";
const ADS_CORE_URL =
  process.env.ADS_CORE_URL ||
  (isDev ? "http://localhost:8096" : "http://clisonix-ads-core:8096");
const adsenseConfig = getAdsenseConfigStatus();
const ADSENSE_PUBLISHER_ID = adsenseConfig.publisherId;
const ADSENSE_REVIEW_MODE = isAdsenseReviewMode();
const ADSENSE_AUTO_ADS = isAdsenseAutoAdsEnabled();

const AD_SLOT_NAMES: ReadonlySet<AdSlotName> = new Set([
  "footer",
  "sidebar",
  "article_top",
  "article_bottom",
]);

function isAdSlotName(value: string): value is AdSlotName {
  return AD_SLOT_NAMES.has(value as AdSlotName);
}

if (!adsenseConfig.isConfigured) {
  console.warn(
    "[api/ads/config] AdSense disabled: publisher ID missing. Set NEXT_PUBLIC_GOOGLE_ADSENSE_ID or GOOGLE_ADSENSE_PUBLISHER_ID.",
  );
}

function adsenseFallback(slot: string, consent: string) {
  const consentGranted = consent === "true" || (isDev && ADSENSE_REVIEW_MODE);

  if (!ADSENSE_PUBLISHER_ID || !consentGranted) {
    return NextResponse.json(
      {
        enabled: false,
        reason: ADSENSE_PUBLISHER_ID ? "no_consent" : "not_configured",
        provider: "none",
        slot,
      },
      { status: 200 },
    );
  }

  const adSlotName: AdSlotName = isAdSlotName(slot) ? slot : "footer";
  const adSlot = getAdsenseSlotId(adSlotName);

  if (!adSlot && ADSENSE_AUTO_ADS) {
    return NextResponse.json(
      {
        enabled: true,
        provider: "google_adsense",
        slot,
        publisher_id: ADSENSE_PUBLISHER_ID,
        script_url: getAdsenseScriptUrl(ADSENSE_PUBLISHER_ID),
        script_attrs: {
          async: "true",
          crossorigin: "anonymous",
          "data-ad-client": ADSENSE_PUBLISHER_ID,
        },
        render_mode: "auto_ads",
        review_mode: ADSENSE_REVIEW_MODE,
        auto_ads: true,
      },
      { status: 200 },
    );
  }

  if (!adSlot) {
    return NextResponse.json(
      { enabled: false, reason: "slot_not_configured", provider: "none", slot },
      { status: 200 },
    );
  }

  return NextResponse.json(
    {
      enabled: true,
      provider: "google_adsense",
      slot,
      publisher_id: ADSENSE_PUBLISHER_ID,
      ad_slot: adSlot,
      script_url: getAdsenseScriptUrl(ADSENSE_PUBLISHER_ID),
      script_attrs: {
        async: "true",
        crossorigin: "anonymous",
        "data-ad-client": ADSENSE_PUBLISHER_ID,
      },
      render_mode: "adsense",
    },
    { status: 200 },
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slot = url.searchParams.get("slot") || "footer";
  const consent = url.searchParams.get("consent") || "false";
  const country = url.searchParams.get("country") || "";

  // Try primary ads-core service first
  try {
    const upstream = await fetch(
      `${ADS_CORE_URL}/api/v1/ads/config?slot=${encodeURIComponent(slot)}&consent=${encodeURIComponent(consent)}&country=${encodeURIComponent(country)}`,
      { method: "GET", cache: "no-store", signal: AbortSignal.timeout(3000) },
    );
    if (upstream.ok) {
      const data = await upstream.json();
      if (data?.enabled) return NextResponse.json(data, { status: 200 });
    }
  } catch {
    // ads-core unavailable — fall through to AdSense
  }

  // Fallback: serve Google AdSense config
  return adsenseFallback(slot, consent);
}
