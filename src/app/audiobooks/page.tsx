import type { Metadata } from "next";
import { HomeView } from "@/components/HomeView";
import { COLLECTION_TITLES, OG_BASE } from "@/lib/site";

export const metadata: Metadata = {
  title: COLLECTION_TITLES.audiobook,
  description: "Audiobooks on CD and free eAudiobooks on BorrowBox and Libby from Brighton & Hove libraries. See what's on the shelf and search the whole catalogue.",
  alternates: { canonical: "/audiobooks" },
  openGraph: { ...OG_BASE, title: COLLECTION_TITLES.audiobook, description: "Audiobooks on CD and free eAudiobooks on BorrowBox and Libby from Brighton & Hove libraries. See what's on the shelf and search the whole catalogue.", url: "/audiobooks" },
};

export default function AudiobooksHome() {
  return <HomeView kind="audiobook" />;
}
