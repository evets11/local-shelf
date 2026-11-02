import type { CardTitle } from "@/lib/card";
import { TitleCard } from "./TitleCard";

export function TitleGrid({ items }: { items: CardTitle[] }) {
  return (
    <div data-pref-filtered className="card-grid gap-x-3 gap-y-7 sm:gap-x-5">
      {items.map((t, i) => (
        <TitleCard key={t.irn} t={t} eager={i < 16} />
      ))}
    </div>
  );
}
