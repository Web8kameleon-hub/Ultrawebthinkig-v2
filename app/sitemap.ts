/**
 * UltraWeb AI — Sitemap Generator
 * Next.js App Router Sitemap
 *
 * @author Ledjan Ahmati (100% Owner)
 * @version 8.0.0 Ultra
 */

import { MetadataRoute } from 'next'

const BASE_URL = 'https://ultraweb.ai'

/** Routes with weekly change cadence (feature pages) */
const weeklyRoutes = [
  '/ultra-saas',
  '/agi',
  '/agi-demo',
  '/agi-search-demo',
  '/agi-tunnel',
  '/agimed',
  '/agimed-professional',
  '/agioffice',
  '/agixbionature-demo',
  '/ai-manager',
  '/albamed-demo',
  '/albion-utt',
  '/asi-12layer',
  '/asi-dashboard',
  '/asi-ultimate',
  '/openmind',
  '/openmind-chat',
  '/openmind-enhanced',
  '/neural-search-demo',
]

/** Routes with monthly change cadence (tools & demos) */
const monthlyRoutes = [
  '/browser',
  '/aviation-weather',
  '/chat',
  '/cyber-security',
  '/dashboard',
  '/guardian',
  '/guardian-demo',
  '/infinite-bandwidth',
  '/iot-manager',
  '/light-speed-io',
  '/lora-mesh',
  '/mesh',
  '/mirror-demo',
  '/mirrors',
  '/neural-acceleration',
  '/neural-dev',
  '/overview',
  '/quantum-processing',
  '/radio-propaganda',
  '/real-search-demo',
  '/revolution',
  '/saas-dashboard',
  '/system-layers',
  '/ultra-industrial',
  '/ultra-speed',
  '/utt-tools',
  '/web-search-demo',
  '/web8-test',
  '/zero-latency',
  '/api-gateway',
  '/api-integration',
  '/api-producer',
  '/advanced-security',
  '/time-compression',
  '/fluid-demo',
  '/cva-demo',
  '/lazy-demo',
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const home: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]

  const weekly: MetadataRoute.Sitemap = weeklyRoutes.map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.9,
  }))

  const monthly: MetadataRoute.Sitemap = monthlyRoutes.map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  return [...home, ...weekly, ...monthly]
}
