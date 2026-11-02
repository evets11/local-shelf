import type { MetadataRoute } from "next";
import { getAllTitles, getCatalog } from "@/lib/catalog";
import { MODES } from "@/lib/modes";
import { absolute } from "@/lib/site";

/** Collection pages plus every title (about 5,000, well under the 50,000-per-file limit). */
export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date(getCatalog("film").generatedAt);
  const pages: MetadataRoute.Sitemap = [
    ...MODES.flatMap((m) => [
      { url: absolute(m.home), lastModified: updated, changeFrequency: "daily" as const, priority: 1 },
      { url: absolute(`/browse/${m.slug}`), lastModified: updated, changeFrequency: "daily" as const, priority: 0.8 },
    ]),
    { url: absolute("/about"), changeFrequency: "monthly", priority: 0.5 },
    { url: absolute("/support"), changeFrequency: "yearly", priority: 0.3 },
  ];
  const titles = getAllTitles().map((t) => ({
    url: absolute(`/title/${t.irn}`),
    // Availability (and so the page's description) can change with every nightly sync.
    lastModified: updated,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));
  return [...pages, ...titles];
}
