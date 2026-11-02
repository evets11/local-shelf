import "server-only";
import prizesJson from "../../../data/prizes.json";
import { getTitle } from "../catalog";
import { toCard, type CardTitle } from "../card";
import type { Kind } from "../types";
import {
  PRIZES,
  STAGE_LABEL,
  prizeAnchor,
  prizeById,
  type PrizeEntry,
  type PrizesFile,
} from "./config";
import { STAGE_ORDER } from "./wikitext";

const file = prizesJson as PrizesFile;

/** A prize book the library holds, with a card per format (print first). */
export interface PrizePick {
  id: string;
  /** e.g. "Shortlisted" or, on mixed rows, "Booker shortlist". */
  label: string;
  cards: CardTitle[];
}

export interface PrizeSection {
  anchor: string;
  prize: { id: string; name: string; site: string; children: boolean };
  year: number;
  /** Books on this year's list(s), held or not. */
  listed: number;
  picks: PrizePick[];
}

const prizeOrder = (e: PrizeEntry) => PRIZES.findIndex((p) => p.id === e.prize);
const byStage = (a: PrizeEntry, b: PrizeEntry) =>
  STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || a.title.localeCompare(b.title);

/** Cards for the entry's records that made it into the catalogue (a sync may not have run yet). */
function cardsFor(e: PrizeEntry, kind?: Kind): CardTitle[] {
  return e.matches
    .filter((m) => !kind || m.kind === kind)
    .map((m) => getTitle(m.irn))
    .filter((t) => t !== undefined)
    .map(toCard);
}

/** Every followed prize and year, newest year first within each prize. */
export function getPrizeSections(): PrizeSection[] {
  return PRIZES.flatMap((p) => {
    const mine = file.entries.filter((e) => e.prize === p.id);
    const years = [...new Set(mine.map((e) => e.year))].sort((a, b) => b - a);
    return years.map((year) => {
      const listed = mine.filter((e) => e.year === year);
      return {
        anchor: prizeAnchor(p.id, year),
        prize: {
          id: p.id,
          name: p.name,
          site: p.site,
          children: Boolean(p.children),
        },
        year,
        listed: listed.length,
        picks: listed
          .sort(byStage)
          .map((e) => ({
            id: e.id,
            label: STAGE_LABEL[e.stage],
            cards: cardsFor(e),
          }))
          .filter((x) => x.cards.length > 0),
      };
    });
  });
}

/** When the lists were last checked against Wikipedia. */
export const prizesCheckedAt = file.checkedAt;

/** A mixed row for a collection's home page: this year's and last year's books, winners first. */
export function getPrizePicks(kind: Kind): PrizePick[] {
  const latest = Math.max(0, ...file.entries.map((e) => e.year));
  return file.entries
    .filter((e) => e.year >= latest - 1)
    // Within a year and stage, the order of PRIZES (Booker and Women's Prize before children's prizes).
    .sort((a, b) => b.year - a.year || STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || prizeOrder(a) - prizeOrder(b))
    .map((e) => ({
      id: e.id,
      label: `${prizeById(e.prize)?.short ?? e.prize} ${e.stage === "winner" ? "winner" : e.stage}`,
      cards: cardsFor(e, kind),
    }))
    .filter((x) => x.cards.length > 0);
}

/** Prize mentions for a title page, e.g. Booker Prize 2026, Shortlisted. */
export function prizesFor(
  irn: string,
): { name: string; year: number; stage: string; anchor: string }[] {
  return file.entries
    .filter((e) => e.matches.some((m) => m.irn === irn))
    .sort(
      (a, b) => b.year - a.year || STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage],
    )
    .map((e) => ({
      name: prizeById(e.prize)?.name ?? e.prize,
      year: e.year,
      stage: STAGE_LABEL[e.stage],
      anchor: prizeAnchor(e.prize, e.year),
    }));
}
