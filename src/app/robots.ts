import type { MetadataRoute } from "next";
import { absolute } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // Everyone, AI crawlers included: being found is the point. APIs are live library lookups.
    // GPTBot and ClaudeBot skip title pages: they crawled ~6k a day, which blew through Vercel's
    // free ISR writes. Also blocked by a Vercel Firewall rule, as robots.txt is advisory.
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/"] },
      {
        userAgent: ["GPTBot", "ClaudeBot"],
        allow: "/",
        disallow: ["/api/", "/title/"],
      },
    ],
    sitemap: absolute("/sitemap.xml"),
  };
}
