import type { Metadata } from "next";
import { HomeView } from "@/components/HomeView";
import { JsonLd } from "@/components/JsonLd";
import { DEFAULT_TITLE, OG_BASE, SITE_DESCRIPTION, SITE_NAME, absolute } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { ...OG_BASE, title: DEFAULT_TITLE, description: SITE_DESCRIPTION, url: "/" },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  alternateName: "Local Shelf Brighton & Hove",
  url: absolute("/"),
  description: SITE_DESCRIPTION,
  inLanguage: "en-GB",
  about: {
    "@type": "Library",
    name: "Brighton & Hove Libraries",
    url: "https://www.brighton-hove.gov.uk/libraries-leisure-and-arts/libraries",
    areaServed: "Brighton and Hove",
  },
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: absolute("/search/films?q={search_term_string}") },
    "query-input": "required name=search_term_string",
  },
};

export default function FilmsHome() {
  return (
    <>
      <JsonLd data={websiteJsonLd} />
      <HomeView kind="film" />
    </>
  );
}
