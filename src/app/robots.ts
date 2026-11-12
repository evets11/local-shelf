import type { MetadataRoute } from "next";
import { absolute } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // /api/ and /item are live library lookups. /search/ is noindex, and the cast/crew links on
  // every title make it an endless crawl that also fires live library searches.
  const disallow = ["/api/", "/item", "/search/"];
  return {
    // Everyone else, AI crawlers included: being found is the point.
    // GPTBot and ClaudeBot skip title pages: they crawled ~6k a day, which blew through Vercel's
    // free ISR writes. Also blocked by a Vercel Firewall rule, as robots.txt is advisory.
    rules: [
      { userAgent: "*", allow: "/", disallow },
      {
        userAgent: ["GPTBot", "ClaudeBot"],
        allow: "/",
        disallow: [...disallow, "/title/"],
      },
    ],
    sitemap: absolute("/sitemap.xml"),
  };
}
