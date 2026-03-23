import { MetadataRoute } from 'next';

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
  ];

  const moduleRoutes = [
    "about-us",
    "account",
    "albi-eeg-live",
    "archive",
    "aviation-weather",
    "crypto-dashboard",
    "curiosity-ocean",
    "daily-habits",
    "data-collection",
    "developer-docs",
    "eeg-analysis",
    "excel-dashboard",
    "fitness-dashboard",
    "focus-timer",
    "functions-registry",
    "how-to-use",
    "hybrid-biometric-dashboard",
    "industrial-dashboard",
    "jona-neural",
    "mood-journal",
    "music-studio",
    "my-data-dashboard",
    "mymirror-now",
    "neural-biofeedback",
    "neural-synthesis",
    "neuroacoustic-converter",
    "omnitalk",
    "openmind",
    "phone-monitor",
    "phone-sensors",
    "protocol-kitchen",
    "reporting-dashboard",
    "social-intelligence",
    "specialized-chat",
    "spectrum-analyzer",
    "user-data",
    "weather-dashboard",
    "web-reader",
  ];

  const dashboardModules = moduleRoutes.map((module) => ({
    url: `${baseUrl}/modules/${module}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: module === "curiosity-ocean" || module === "web-reader" ? 0.8 : 0.72,
  }));

  return [...corePages, ...dashboardModules];
}
