import type { Metadata } from "next";
import { MyListView } from "@/components/MyListView";

export const metadata: Metadata = { title: "My List", robots: { index: false, follow: true } };

export default function MyListPage() {
  return <MyListView />;
}
