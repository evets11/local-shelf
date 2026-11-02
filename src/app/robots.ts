import type { MetadataRoute } from "next";
import { absolute } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // Everyone, AI crawlers included: being found is the point. APIs are live library lookups.
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: absolute("/sitemap.xml"),
  };
}
