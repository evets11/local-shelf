import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BadRequestError,
  ExpiredResultError,
  RateLimitedError,
  getLibraryRecord,
  normaliseQuery,
  rankHits,
  searchLibrary,
  toLibraryHits,
} from "../src/lib/spydus/client";
import { parseListPage } from "../src/lib/spydus/parse";

const fx = (name: string) =>
  readFileSync(join(__dirname, "fixtures", name), "utf8");

/** Route mocked fetches by URL fragment to fixture HTML. */
function mockFetch(routes: [RegExp, string][]) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    const hit = routes.find(([re]) => re.test(url));
    return hit
      ? new Response(hit[1])
      : new Response("not found", { status: 404 });
  });
}

afterEach(() => vi.restoreAllMocks());

describe("query validation", () => {
  it("trims, collapses and bounds the query", () => {
    expect(normaliseQuery("  wolf   hall ")).toBe("wolf hall");
    expect(() => normaliseQuery("ab")).toThrow(BadRequestError);
    expect(() => normaliseQuery("x".repeat(101))).toThrow(BadRequestError);
    expect(() => normaliseQuery(undefined)).toThrow(BadRequestError);
  });

  it("rejects bad record references before any fetch", () => {
    const f = mockFetch([]);
    expect(() => getLibraryRecord("abc", "1", 1)).toThrow(BadRequestError);
    expect(() => getLibraryRecord("1", "1", 0)).toThrow(BadRequestError);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("search hits", () => {
  it("maps book search cards to LibraryHit with byline and position", () => {
    const p = parseListPage(fx("search-book.html"), "book");
    const hits = toLibraryHits("book", p.records);
    const wh = hits.find((h) => h.title === "Wolf Hall")!;
    expect(wh).toMatchObject({
      kind: "book",
      byline: "Hilary Mantel",
      format: "Book",
      certificate: null,
      genres: [],
      branches: [],
      availableAt: [],
      audience: null,
      onOrder: false,
      rtScore: null,
      isEItem: false,
    });
    expect(wh.pos).toBeGreaterThan(0);
    expect(wh.copies).toBeGreaterThan(0);
  });

  it("flags eAudiobooks", () => {
    const hits = toLibraryHits(
      "audiobook",
      parseListPage(fx("search-audiobook.html"), "audiobook").records,
    );
    expect(hits[0]).toMatchObject({
      title: "Bring Up the Bodies",
      format: "eAudiobook",
      isEItem: true,
      pos: 1,
    });
  });

  it("re-ranks so the exact title comes first", () => {
    const hits = toLibraryHits(
      "book",
      parseListPage(fx("search-book.html"), "book").records,
    );
    expect(rankHits("wolf hall", hits)[0].title).toBe("Wolf Hall");
  });
});

describe("searchLibrary", () => {
  it("parses, ranks and caches a search", async () => {
    const f = mockFetch([[/ENTRY=wolf%20hall/i, fx("search-book.html")]]);
    const r = await searchLibrary("book", "Wolf Hall");
    expect(r.setId).toMatch(/^\d+$/);
    expect(r.total).toBe(10);
    expect(r.hits[0].title).toBe("Wolf Hall");
    await searchLibrary("book", "  wolf HALL ");
    expect(f).toHaveBeenCalledTimes(1);
    expect(String(f.mock.calls[0][0])).toContain("SORTS=SQL_REL_BIB&NRECS=40");
  });

  it("returns an empty result for no matches", async () => {
    mockFetch([[/ENTRY=/, fx("search-nohits.html")]]);
    expect(await searchLibrary("audiobook", "zzqxjvq plimbrod")).toEqual({
      setId: "",
      total: 0,
      hits: [],
    });
  });

  it("rate-limits library searches per instance", async () => {
    mockFetch([[/ENTRY=/, fx("search-nohits.html")]]);
    const tries = Array.from({ length: 40 }, (_, i) => `limit test ${i}`);
    let limited = 0;
    for (const q of tries) {
      try {
        await searchLibrary("book", q);
      } catch (e) {
        if (e instanceof RateLimitedError) limited++;
      }
    }
    // 30/min minus the two searches above.
    expect(limited).toBe(12);
  });
});

describe("getLibraryRecord", () => {
  it("builds a Title from the full page and live holdings", async () => {
    mockFetch([
      [
        /\/FULL\/OPAC\/BIBENQ\/111\/193995142,1/,
        fx("full-audiocd-193995142.html"),
      ],
      [
        /\/XHLD\//,
        fx("holdings-184363818.html").replaceAll("184363818", "193995142"),
      ],
    ]);
    const t = await getLibraryRecord("111", "193995142", 1);
    expect(t).toMatchObject({
      kind: "audiobook",
      format: "Audiobook CD",
      title: "26 beauties",
      authors: ["James Patterson"],
      narrators: ["January LaVoy"],
      isbn: "9781038051950",
      brn: "9142115",
      copies: 3,
      available: 3,
      certificate: null,
    });
    expect(t.availableAt).toEqual([
      "Hove Library",
      "Jubilee Library",
      "Patcham Library",
    ]);
  });

  it("skips holdings for e-items", async () => {
    const f = mockFetch([[/\/FULL\//, fx("full-eaudio-194014219.html")]]);
    const t = await getLibraryRecord("222", "194014219", 3);
    expect(t).toMatchObject({ format: "eAudiobook", copies: 0, holdings: [] });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("reports an expired set when the page is for another record and no BRN is known", async () => {
    mockFetch([[/\/FULL\//, fx("full-amadeus.html")]]);
    await expect(getLibraryRecord("333", "777777", 5)).rejects.toThrow(
      ExpiredResultError,
    );
  });
});
