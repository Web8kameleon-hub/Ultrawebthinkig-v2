export const DEFAULT_ADSENSE_PUBLISHER_ID = "ca-pub-4323173449597062";
export const ADSENSE_ID_PATTERN = /^ca-pub-\d{16}$/;

export type AdSlotName = "footer" | "sidebar" | "article_top" | "article_bottom";

type AdsConfigEnv = Record<string, string | undefined>;

export function resolveAdsensePublisherId(raw?: string): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  if (value.includes("XXXXXXXX")) return "";
  if (!ADSENSE_ID_PATTERN.test(value)) return "";
  return value;
}

export function getAdsensePublisherId(env: AdsConfigEnv = process.env): string {
  return (
    resolveAdsensePublisherId(env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID) ||
    resolveAdsensePublisherId(env.GOOGLE_ADSENSE_PUBLISHER_ID) ||
    DEFAULT_ADSENSE_PUBLISHER_ID
  );
}

export function getAdsensePublisherAccountId(env: AdsConfigEnv = process.env): string {
  const publisherId = getAdsensePublisherId(env);
  return publisherId.startsWith("ca-") ? publisherId.slice(3) : publisherId;
}

export function getAdsenseScriptUrl(publisherId: string): string {
  return `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`;
}

export function getAdsenseSlots(env: AdsConfigEnv = process.env): Record<AdSlotName, string> {
  return {
    footer: env.ADSENSE_SLOT_FOOTER ?? "",
    sidebar: env.ADSENSE_SLOT_SIDEBAR ?? "",
    article_top: env.ADSENSE_SLOT_ARTICLE_TOP ?? "",
    article_bottom: env.ADSENSE_SLOT_ARTICLE_BOTTOM ?? "",
  };
}

export function getAdsenseSlotId(slot: AdSlotName, env: AdsConfigEnv = process.env): string {
  return getAdsenseSlots(env)[slot] ?? "";
}