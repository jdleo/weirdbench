import type { MetadataRoute } from "next";
import { benchmarkRegistry } from "@/lib/benchmarks";
import { siteConfig } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: siteConfig.url,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteConfig.url}/intelligence-index`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...benchmarkRegistry.map((benchmark) => ({
      url: `${siteConfig.url}/benchmarks/${benchmark.id}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
