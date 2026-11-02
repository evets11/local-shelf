import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Local Shelf: Brighton & Hove Libraries",
    short_name: "Local Shelf",
    description:
      "Browse the films, TV, books and audiobooks you can borrow from Brighton & Hove libraries.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    // Matches the default dark theme so launch doesn't flash.
    background_color: "#0e1014",
    theme_color: "#0e1014",
    lang: "en-GB",
    categories: ["books", "entertainment", "education"],
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/pwa/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Films & TV", url: "/", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
      { name: "Books", url: "/books", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
      { name: "Audiobooks", url: "/audiobooks", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
      { name: "My List", url: "/my-list", icons: [{ src: "/pwa/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
