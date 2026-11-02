import type { Metadata } from "next";
import { HomeView } from "@/components/HomeView";
import { COLLECTION_TITLES, OG_BASE } from "@/lib/site";

export const metadata: Metadata = {
  title: COLLECTION_TITLES.book,
  description: "New books and eBooks at Brighton & Hove libraries: fiction, non-fiction and children's books, with what's on the shelf at each library right now. Search the whole library catalogue.",
  alternates: { canonical: "/books" },
  openGraph: { ...OG_BASE, title: COLLECTION_TITLES.book, description: "New books and eBooks at Brighton & Hove libraries: fiction, non-fiction and children's books, with what's on the shelf at each library right now. Search the whole library catalogue.", url: "/books" },
};

export default function BooksHome() {
  return <HomeView kind="book" />;
}
