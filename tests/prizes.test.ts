import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { prizeById, type PrizeEntry } from "../src/lib/prizes/config";
import {
  authorMatches,
  pickMatches,
  searchText,
  titleMatches,
} from "../src/lib/prizes/match";
import {
  addMatches,
  entriesFromPages,
  indexCandidates,
  looksBroken,
  mergeEntries,
  needsSearch,
  searchCandidates,
} from "../src/lib/prizes/update";
import {
  expandTemplates,
  prizeRows,
  splitTop,
} from "../src/lib/prizes/wikitext";
import { formatOf } from "../src/lib/spydus/client";
import { parseListPage } from "../src/lib/spydus/parse";

const wiki = (name: string) =>
  readFileSync(
    join(__dirname, "fixtures", "wikipedia", `${name}.wikitext`),
    "utf8",
  );
const fx = (name: string) =>
  readFileSync(join(__dirname, "fixtures", name), "utf8");

describe("wikitext", () => {
  it("splits only on top-level pipes", () => {
    expect(splitTop("a|[[b|c]]|{{d|e}}|f", "|")).toEqual([
      "a",
      "[[b|c]]",
      "{{d|e}}",
      "f",
    ]);
  });

  it("expands sortname, keeping a link that fixes a misspelt display name", () => {
    expect(expandTemplates("{{sortname|Helen|Garner}}")).toBe("Helen Garner");
    expect(expandTemplates("{{sortname|last=Barne|first=Kitty}}")).toBe(
      "Kitty Barne",
    );
    expect(
      expandTemplates(
        "{{sortname|Natasha|Browne|link=Natasha Brown (author)}}",
      ),
    ).toBe("[[Natasha Brown (author)|Natasha Browne]]");
    expect(expandTemplates("''{{Sort|Persians, The|The Persians}}''")).toBe(
      "''The Persians''",
    );
    // Nested footnotes vanish whole.
    expect(expandTemplates("2025{{Efn|judges were {{sortname|A|B}}}} x")).toBe(
      "2025 x",
    );
  });

  it("reads a per-year Booker page: longlist uncoloured, shortlist grey, winner gold", () => {
    const rows = prizeRows(wiki("booker-2025"));
    expect(rows).toHaveLength(13);
    expect(rows.find((r) => r.title === "Flesh")).toMatchObject({
      stage: "winner",
      authors: ["David Szalay"],
    });
    expect(rows.filter((r) => r.stage === "shortlist")).toHaveLength(5);
    expect(rows.find((r) => r.title === "The South")).toMatchObject({
      stage: null,
      year: null,
    });
  });

  it("carries rowspans for year and result, and reads {{won}}/{{sho}}", () => {
    const nf = prizeRows(wiki("womens-nonfiction")).filter(
      (r) => r.year === 2026,
    );
    expect(nf).toHaveLength(6);
    expect(nf.find((r) => r.title === "Mother Mary Comes to Me")).toMatchObject(
      { stage: "shortlist", authors: ["Arundhati Roy"] },
    );
    const bg = prizeRows(wiki("baillie-gifford")).filter(
      (r) => r.year === 2025,
    );
    expect(bg.find((r) => r.stage === "winner")?.title).toBe(
      "How to End a Story: Collected Diaries",
    );
  });

  it("takes the English title of translated books and the stage from an Award column", () => {
    const ib = prizeRows(wiki("international-booker")).filter(
      (r) => r.year === 2026,
    );
    expect(ib.find((r) => r.stage === "winner")).toMatchObject({
      title: "Taiwan Travelogue",
    });
    expect(ib.find((r) => r.title === "The Witch")?.stage).toBe("shortlist");
  });

  it("uses section headings for the year and keeps the category", () => {
    const rows = prizeRows(wiki("waterstones-childrens")).filter(
      (r) => r.year === 2026,
    );
    expect(rows.find((r) => r.title === "Til Death")).toMatchObject({
      stage: "shortlist",
      note: "Older Readers · Shortlist",
    });
  });

  it("keeps Wikipedia's link target as an alternative author name", () => {
    const row = prizeRows(wiki("waterstones")).find(
      (r) => r.title === "Universality",
    );
    expect(row?.authors).toEqual(["Natasha Browne", "Natasha Brown"]);
  });
});

describe("entries", () => {
  it("keeps the latest two years and merges duplicate rows, best stage first", () => {
    const e = entriesFromPages(prizeById("waterstones-childrens")!, [
      { year: null, wikitext: wiki("waterstones-childrens") },
    ]);
    expect(new Set(e.map((x) => x.year))).toEqual(new Set([2025, 2026]));
    const blob = e.filter((x) => x.title === "Sleep Tight, Disgusting Blob");
    expect(blob).toHaveLength(1);
    expect(blob[0]).toMatchObject({ stage: "winner", children: true });
  });

  it("gives per-year pages their year and the prize's default stage", () => {
    const e = entriesFromPages(prizeById("booker")!, [
      { year: 2026, wikitext: wiki("booker-2026") },
      { year: 2025, wikitext: wiki("booker-2025") },
    ]);
    expect(e).toHaveLength(26);
    expect(e.find((x) => x.title === "Switzy")).toMatchObject({
      year: 2026,
      stage: "longlist",
      children: false,
    });
  });

  it("marks children's categories of general prizes", () => {
    const e = entriesFromPages(prizeById("nero")!, [
      { year: null, wikitext: wiki("nero") },
    ]);
    expect(e.find((x) => x.title === "Dragonborn")?.children).toBe(true);
    expect(e.find((x) => x.title === "Seascraper")?.children).toBe(false);
  });

  const entry = (over: Partial<PrizeEntry> = {}): PrizeEntry => ({
    id: "booker|2026|switzy",
    prize: "booker",
    year: 2026,
    stage: "longlist",
    title: "Switzy",
    authors: ["Emma Cline"],
    note: "",
    children: false,
    firstSeen: "2026-08-01T00:00:00.000Z",
    searched: null,
    matches: [],
    ...over,
  });

  it("refuses a parse that lost most of a year's books", () => {
    const prev = Array.from({ length: 13 }, (_, i) => entry({ id: `x${i}` }));
    expect(looksBroken(prev, [])).toBe(true);
    expect(looksBroken(prev, prev.slice(0, 4))).toBe(true);
    expect(looksBroken(prev, prev.slice(0, 12))).toBe(false);
    // A new year with nothing before it is fine.
    expect(looksBroken(prev, [entry({ year: 2027 })])).toBe(false);
  });

  it("carries searches and matches over when a book moves up a stage", () => {
    const old = entry({
      searched: { at: "2026-08-01T00:00:00.000Z", tries: 1 },
    });
    const [merged] = mergeEntries(
      [old],
      [{ ...old, stage: "shortlist" }],
      "2026-09-30T00:00:00.000Z",
    );
    expect(merged).toMatchObject({
      stage: "shortlist",
      firstSeen: old.firstSeen,
      searched: old.searched,
    });
  });

  it("searches once, then about monthly for a few months, and never once found", () => {
    const now = "2026-11-02T00:00:00.000Z";
    expect(needsSearch(entry(), now)).toBe(true);
    expect(
      needsSearch(
        entry({ searched: { at: "2026-10-20T00:00:00.000Z", tries: 1 } }),
        now,
      ),
    ).toBe(false);
    expect(
      needsSearch(
        entry({ searched: { at: "2026-09-20T00:00:00.000Z", tries: 1 } }),
        now,
      ),
    ).toBe(true);
    expect(
      needsSearch(
        entry({ searched: { at: "2026-01-01T00:00:00.000Z", tries: 6 } }),
        now,
      ),
    ).toBe(false);
    const m = {
      irn: "1",
      brn: "2",
      kind: "book" as const,
      format: "Book" as const,
    };
    expect(needsSearch(entry({ matches: [m] }), now)).toBe(false);
  });
});

describe("matching", () => {
  it("matches main titles, ignoring subtitles, case, articles and accents", () => {
    expect(
      titleMatches(
        "The Things We Never Say",
        "The things we never say: a novel",
      ),
    ).toBe(true);
    expect(
      titleMatches(
        "Captives and Companions: A History of Slavery",
        "Captives and companions",
      ),
    ).toBe(true);
    expect(
      titleMatches(
        "The Café at the Edge of the Woods",
        "The cafe at the edge of the woods",
      ),
    ).toBe(true);
    expect(titleMatches("Flesh", "Flashlight")).toBe(false);
  });

  it("matches authors by surname, including link-target spellings", () => {
    expect(authorMatches(["R. F. Kuang"], ["Rebecca F. Kuang"])).toBe(true);
    expect(
      authorMatches(["Natasha Browne", "Natasha Brown"], ["Natasha Brown"]),
    ).toBe(true);
    expect(authorMatches(["Uketsu"], ["Uketsu"])).toBe(true);
    expect(authorMatches(["David Szalay"], ["Sally Rooney"])).toBe(false);
    expect(authorMatches(["Beth O'Brien"], ["Beth OBrien", null])).toBe(true);
  });

  it("searches for the main title plus surname, within the length cap", () => {
    expect(
      searchText("Days of Love and Rage: A Story of Revolution", [
        "Anand Gopal",
      ]),
    ).toBe("days of love and rage gopal");
    expect(
      searchText("x ".repeat(80), ["Someone Long"]).length,
    ).toBeLessThanOrEqual(100);
  });

  it("finds every format in one search and keeps one record per format", () => {
    const html = fx("search-prize-strout.html");
    const records = (["book", "audiobook"] as const).flatMap((kind) =>
      parseListPage(html, kind).records.map((rec) => ({
        rec,
        kind,
        format: formatOf(kind, rec),
      })),
    );
    const found = searchCandidates(
      { title: "The Things We Never Say", authors: ["Elizabeth Strout"] },
      records,
    );
    expect(pickMatches(found).map((m) => m.format)).toEqual([
      "Book",
      "eBook",
      "Audiobook CD",
      "eAudiobook",
    ]);
    expect(
      searchCandidates(
        { title: "The Things We Never Say", authors: ["Someone Else"] },
        records,
      ),
    ).toEqual([]);
  });

  it("matches our own index and keeps existing matches per format", () => {
    const t = {
      irn: "9",
      brn: "8",
      kind: "audiobook" as const,
      format: "Audiobook CD" as const,
      title: "Switzy",
      authors: ["Emma Cline"],
      copies: 2,
    };
    const cands = indexCandidates(
      { title: "Switzy", authors: ["Emma Cline"] },
      [t, { ...t, irn: "10", title: "Other" }],
    );
    expect(cands.map((c) => c.irn)).toEqual(["9"]);
    const existing = [
      {
        irn: "1",
        brn: "1",
        kind: "audiobook" as const,
        format: "Audiobook CD" as const,
      },
    ];
    expect(addMatches(existing, cands)).toEqual(existing);
  });
});
