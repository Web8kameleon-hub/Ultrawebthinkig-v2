import { MetadataRoute } from 'next';
import { SEO_INDEXABLE_MODULE_SLUGS } from "../src/lib/modules/platform-map";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.clisonix.com";
  const now = new Date();

  const corePages = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/modules`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/ai-chat`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/modules/how-to-use`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.86,
    },
    {
      url: `${baseUrl}/platform`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/company`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/brand`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.88,
    },
    {
      url: `${baseUrl}/about-us`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.88,
    },
    {
      url: `${baseUrl}/landing`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.82,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.85,
    },
    {
      url: `${baseUrl}/why-clisonix`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/security`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/status`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/developers`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/news`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.76,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.66,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/developers/docs-index`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.84,
    },
    {
      url: `${baseUrl}/docs`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.83,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.65,
    },
    {
      url: `${baseUrl}/refund-policy`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.64,
    },
  ];

  const moduleRoutes = Array.from(new Set(SEO_INDEXABLE_MODULE_SLUGS)).filter(
    (module) => module !== "how-to-use",
  );

  const dashboardModules = moduleRoutes.map((module) => ({
    url: `${baseUrl}/modules/${module}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: module === "curiosity-ocean" || module === "web-reader" ? 0.8 : 0.72,
  }));

  return [...corePages, ...dashboardModules];
}
