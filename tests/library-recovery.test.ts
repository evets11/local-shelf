import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ExpiredResultError,
  getLibraryRecord,
  searchLibrary,
} from "../src/lib/spydus/client";

const fx = (name: string) =>
  readFileSync(join(__dirname, "fixtures", name), "utf8");

function mockFetch(handler: (url: string) => string | Response) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const out = handler(String(input));
    return typeof out === "string" ? new Response(out) : out;
  });
}

afterEach(() => vi.restoreAllMocks());

describe("search responses", () => {
  it("only treats the library's explicit no-hits page as no results", async () => {
    mockFetch(() => fx("search-nohits.html"));
    expect(await searchLibrary("book", "nothing here")).toEqual({
      setId: "",
      total: 0,
      hits: [],
    });
  });

  it("treats a maintenance page as an upstream error and doesn't cache it", async () => {
    let n = 0;
    mockFetch(() =>
      n++ === 0
        ? "<html><body>Service temporarily unavailable</body></html>"
        : fx("search-book.html"),
    );
    await expect(searchLibrary("book", "Wolf Hall")).rejects.toThrow(
      /Unexpected search response/,
    );
    const r = await searchLibrary("book", "Wolf Hall");
    expect(r.hits[0].title).toBe("Wolf Hall");
  });

  it("adds the children's filter and marks hits, cached separately", async () => {
    const f = mockFetch(() => fx("search-audiobook.html"));
    const kids = await searchLibrary("audiobook", "wolf hall", "children");
    expect(String(f.mock.calls[0][0])).toContain(
      encodeURIComponent("BTYP: I + AUD: (J / A / B)"),
    );
    expect(kids.hits.every((h) => h.audience === "children")).toBe(true);
    const all = await searchLibrary("audiobook", "wolf hall");
    expect(all.hits.every((h) => h.audience === null)).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
  });
});

describe("record recovery", () => {
  it("re-runs the search once for a fresh set when the old one has expired", async () => {
    const urls: string[] = [];
    mockFetch((url) => {
      urls.push(url);
      if (url.includes("/FULL/OPAC/BIBENQ/111/"))
        return fx("full-amadeus.html"); // dead set: wrong record
      if (url.includes("ENTRY="))
        // A fresh set, with our IRN as its first hit.
        return fx("search-audiobook.html")
          .replace(/488369262/g, "999")
          .replace(/7329508/g, "194014219");
      if (url.includes("/FULL/OPAC/BIBENQ/999/194014219,"))
        return fx("full-eaudio-194014219.html");
      return new Response("nope", { status: 404 });
    });
    const t = await getLibraryRecord("111", "194014219", 7, {
      kind: "audiobook",
      q: "gulls nest",
    });
    expect(t.title).toBe("Murder at Gulls Nest");
    expect(urls.filter((u) => u.includes("ENTRY=")).length).toBe(1);
  });

  it("doesn't search again for an IRN the search never returned", async () => {
    const urls: string[] = [];
    mockFetch((url) => {
      urls.push(url);
      if (url.includes("ENTRY=")) return fx("search-audiobook.html");
      return fx("full-amadeus.html"); // every FULL is the wrong record
    });
    await expect(
      getLibraryRecord("111", "424242", 1, { kind: "audiobook", q: "made up" }),
    ).rejects.toThrow(ExpiredResultError);
    expect(urls.filter((u) => u.includes("ENTRY=")).length).toBe(1);
    // A repeat reuses the cached search, so still no second library search.
    await expect(
      getLibraryRecord("111", "424242", 1, { kind: "audiobook", q: "made up" }),
    ).rejects.toThrow(ExpiredResultError);
    expect(urls.filter((u) => u.includes("ENTRY=")).length).toBe(1);
  });

  it("remembers IRNs that aren't books or audiobooks", async () => {
    const f = mockFetch(() => fx("full-amadeus.html"));
    const amadeus = "2359804";
    await expect(getLibraryRecord("111", amadeus, 1)).rejects.toThrow(/Not a book/);
    const calls = f.mock.calls.length;
    await expect(getLibraryRecord("111", amadeus, 1)).rejects.toThrow(/Not a book/);
    expect(f.mock.calls.length).toBe(calls);
  });

  it("throws ExpiredResultError without search context", async () => {
    mockFetch(() => fx("full-amadeus.html"));
    await expect(getLibraryRecord("111", "123123", 1)).rejects.toThrow(
      ExpiredResultError,
    );
  });

  it("flags holdingsUnknown when live holdings fail for a physical item", async () => {
    mockFetch((url) =>
      url.includes("/XHLD/")
        ? new Response("down", { status: 503 })
        : fx("full-audiocd-193995142.html"),
    );
    const t = await getLibraryRecord("222", "193995142", 1);
    expect(t).toMatchObject({
      format: "Audiobook CD",
      holdingsUnknown: true,
      holdings: [],
    });
  });
});
