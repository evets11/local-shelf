"use client";

import { BookmarkCheck, BookmarkPlus } from "lucide-react";
import { useMyList } from "@/lib/my-list";

export function MyListButton({ irn }: { irn: string }) {
  const { has, toggle } = useMyList();
  const saved = has(irn);
  const Icon = saved ? BookmarkCheck : BookmarkPlus;
  return (
    <button
      type="button"
      onClick={() => toggle(irn)}
      aria-pressed={saved}
      title={saved ? "Remove from My List" : "Add to My List"}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 font-semibold transition ${
        saved
          ? "border-sea bg-sea/10 text-sea"
          : "border-line bg-card text-ink hover:border-sea hover:text-sea"
      }`}
    >
      <Icon className="h-5 w-5" />
      {saved ? "Saved" : "Save"}
    </button>
  );
}
