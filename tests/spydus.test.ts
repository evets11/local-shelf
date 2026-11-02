import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  certificateFromCollection,
  cleanTitle,
  deriveAudience,
  isAvailableStatus,
  normaliseGenres,
  parseFullRecord,
  parseHoldings,
  parseListPage,
  parseSpydusDate,
  sortTitle,
} from "../src/lib/spydus/parse";

const fx = (name: string) =>
  readFileSync(join(__dirname, "fixtures", name), "utf8");

describe("parseListPage", () => {
  const page = parseListPage(fx("list-pubdatedesc-100.html"));

  it("reads set id, total and all 100 cards", () => {
    expect(page.setId).toBe("488316421");
    expect(page.total).toBe(1611);
    expect(page.from).toBe(1);
    expect(page.records).toHaveLength(100);
  });

  it("parses the first record", () => {
    const r = page.records[0];
    expect(r).toMatchObject({
      irn: "184363818",
      position: 1,
      title: "28 years later: The bone temple",
      year: 2026,
      ean: "5035822111639",
      available: 3,
      copies: 3,
    });
    expect(r.coverUrl).toContain("ISBN=5035822111639");
    expect(r.coverUrl).not.toContain("&amp;");
  });

  it("reads Amadeus as 0 available of 1", () => {
    const r = page.records.find((x) => x.irn === "2359804")!;
    expect(r.title).toBe("Amadeus");
    expect(r).toMatchObject({ available: 0, copies: 1 });
  });

  it("drops junk serials and handles UUUU years", () => {
    const rel = parseListPage(fx("list-relevance-20.html"));
    expect(rel.dropped.map((d) => d.title)).toEqual([
      "Video servicing : circuit diagrams [Serials (default)]",
    ]);
    expect(rel.records.some((r) => /Serials/.test(r.rawTitle))).toBe(false);
    const red = rel.records.find((r) => r.title === "Red arrows salute")!;
    expect(red.year).toBeNull();
  });
});

describe("parseFullRecord", () => {
  it("parses 28 years later", () => {
    const r = parseFullRecord(fx("full-28-years-later.html"));
    expect(r.irn).toBe("184363818");
    expect(r.brn).toBe("9104038");
    expect(r.title).toBe("28 years later: The bone temple");
    expect(r.directors).toEqual(["Nia DaCosta"]);
    expect(r.cast.slice(0, 3)).toEqual([
      "Ralph Fiennes",
      "Jack O'Connell",
      "Alfie Williams",
    ]);
    expect(r.cast).toContain("Cillian Murphy");
    expect(r.certificate).toBe("18");
    expect(r.runtimeMins).toBe(109);
    expect(r.year).toBe(2026);
    expect(r.releaseYear).toBe(2026);
    expect(r.genres).toContain("Horror");
    expect(r.subjects).toEqual(["Horror films", "Feature -- Horror"]);
    expect(r.languages).toEqual(["English"]);
    expect(r.format).toBe("DVD");
    expect(r.discs).toBe(1);
    expect(r.summary).toMatch(/^Ralph Fiennes.*Cillian Murphy\.$/);
    expect(r.ean).toBe("5035822111639");
  });

  it("parses Amadeus with film year from 'Made in'", () => {
    const r = parseFullRecord(fx("full-amadeus.html"));
    expect(r.irn).toBe("2359804");
    expect(r.brn).toBe("739848");
    expect(r.year).toBe(1984);
    expect(r.releaseYear).toBe(2026);
    expect(r.certificate).toBe("PG");
    expect(r.runtimeMins).toBe(153);
    expect(r.genres).toEqual(["Drama"]);
    expect(r.directors).toHaveLength(1);
    expect(r.cast[0]).toBe("F. Murray Abraham");
  });

  it("parses the BRN lookup page the same way", () => {
    const r = parseFullRecord(fx("brn-lookup-28-years-later.html"));
    expect(r.irn).toBe("184363818");
    expect(r.brn).toBe("9104038");
    expect(r.setId).toMatch(/^\d+$/);
  });
});

describe("credits director fallback", () => {
  const page = (credits: string) =>
    `<div class="row"><div class="fd-caption"><span>Credits: </span></div><div class="col"><span class="d-block">${credits}</span></div></div>`;

  it("takes 'director, X' but not director of photography or art director", () => {
    expect(parseFullRecord(page("Credits: director, Nia DaCosta; writer, Alex Garland.")).directors).toEqual(["Nia DaCosta"]);
    expect(
      parseFullRecord(page("Credits: director of photography, Sean Bobbitt; art director, Jo Bloggs.")).directors,
    ).toEqual([]);
  });
});

describe("parseHoldings", () => {
  it("maps on-loan with due date", () => {
    const [h] = parseHoldings(fx("holdings-193992420.html"));
    expect(h).toEqual({
      branch: "Jubilee Library",
      subLocation: null,
      collection: "DVD 15 premier",
      callNumber: "",
      status: "On loan - Due: 05 Nov 2026",
      available: false,
      dueDate: "2026-11-05",
    });
  });

  it("treats 'Available' as on the shelf", () => {
    const hs = parseHoldings(fx("holdings-184363818.html"));
    expect(hs.map((h) => h.branch)).toEqual([
      "Hove Library",
      "Jubilee Library",
      "Patcham Library",
    ]);
    expect(hs.every((h) => h.available && h.dueDate === null)).toBe(true);
  });

  it("splits stacked location and status spans", () => {
    const row = (loc: string, status: string) =>
      `<table><thead><tr><th>Location</th></tr></thead><tbody><tr><td>${loc}</td><td><span>DVD 15</span></td><td></td><td>${status}</td></tr></tbody></table>`;
    const [h] = parseHoldings(
      row(
        '<span class="d-block">Jubilee Library</span><span class="d-block">Jubilee Library Store</span>',
        '<span class="d-block">AV item (Set: 13 Apr 2017)</span><span class="d-block">On loan - Due: 07 Nov 2026</span>',
      ),
    );
    expect(h).toMatchObject({
      branch: "Jubilee Library",
      subLocation: "Jubilee Library Store",
      status: "AV item (Set: 13 Apr 2017); On loan - Due: 07 Nov 2026",
      available: false,
      dueDate: "2026-11-07",
    });
  });

  it("does not treat 'AV item' or missing as available", () => {
    const [am] = parseHoldings(fx("holdings-2359804.html"));
    expect(am).toMatchObject({
      status: "AV item (Set: 21 Jun 2016)",
      available: false,
      dueDate: null,
    });
    expect(am.callNumber).toBe("DVD CFICDRA");
    expect(am.collection).toBe("DVD U/PG/E");
    const [miss] = parseHoldings(fx("holdings-178666880.html"));
    expect(miss).toMatchObject({
      status: "Missing Shelf Check (Set: 29 May 2026)",
      available: false,
      dueDate: null,
    });
  });
});

describe("helpers", () => {
  it("cleans titles", () => {
    expect(
      cleanTitle("Amadeus [videorecording] / producer, Saul Zaentz."),
    ).toBe("Amadeus");
    expect(cleanTitle("A memoir of my former self : a life in writing / Hilary Mantel.")).toBe(
      "A memoir of my former self: a life in writing",
    );
    expect(cleanTitle("Anaconda (2025) [videorecording]")).toBe(
      "Anaconda (2025)",
    );
  });

  it("makes sort titles", () => {
    expect(sortTitle("The Boxtrolls")).toBe("boxtrolls");
    expect(sortTitle("An American werewolf in London")).toBe(
      "american werewolf in london",
    );
    expect(sortTitle("A quiet place")).toBe("quiet place");
    expect(sortTitle("Anaconda")).toBe("anaconda");
  });

  it("parses dates", () => {
    expect(parseSpydusDate("On loan - Due: 05 Nov 2026")).toBe("2026-11-05");
    expect(parseSpydusDate("nothing")).toBeNull();
  });

  it("normalises genres", () => {
    expect(normaliseGenres(["Feature -- Horror", "Horror films"])).toEqual([
      "Horror",
    ]);
    expect(normaliseGenres(["Animated films"])).toEqual(["Animation"]);
    expect(normaliseGenres(["Children's"])).toEqual(["Family"]);
    expect(normaliseGenres(["Feature -- Foreign"])).toEqual(["World Cinema"]);
    expect(normaliseGenres(["Television series"])).toEqual(["TV"]);
    expect(normaliseGenres(["Documentary films"])).toEqual(["Documentary"]);
    expect(normaliseGenres(["Children's -- Animated Feature"])).toEqual(["Animation", "Family"]);
    expect(normaliseGenres(["Action and adventure films"])).toEqual(["Action", "Adventure"]);
    expect(normaliseGenres(["Fonda, Jane, 1937-"])).toEqual([]);
    expect(normaliseGenres(["Supernatural", "Time travel", "Television series"])).toEqual(["TV"]);
    expect(normaliseGenres(["Nature films", "Travel -- France"])).toEqual(["Documentary"]);
  });

  it("derives certificate and audience", () => {
    expect(certificateFromCollection("DVD 18 premier")).toBe("18");
    expect(certificateFromCollection("DVD U/PG/E")).toBeNull();
    // Adult shelving beats a PG cert (The 400 Blows is PG in "DVD 12").
    expect(deriveAudience("PG", ["DVD 12"], ["World Cinema"])).toBe("adult");
    // U/PG/E is shelving by cert: Amadeus (PG drama) isn't a kids' film.
    expect(deriveAudience("PG", ["DVD U/PG/E"], ["Drama"], ["Feature -- Drama"])).toBeNull();
    expect(deriveAudience(null, ["DVD U/PG/E"], [], [])).toBe("children");
    expect(deriveAudience("U", ["DVD U/PG/E"], [], ["Feature -- Drama"], "A family drama sequel.")).toBe("children");
    expect(deriveAudience("PG", ["DVD U/PG/E"], [], ["Children's -- Feature"])).toBe("children");
    expect(deriveAudience("U", [], [], ["Feature -- Classic"])).toBeNull();
    expect(deriveAudience("PG", [], ["Drama"])).toBeNull();
    expect(deriveAudience("U", [], ["Animation"])).toBe("children");
    expect(deriveAudience("15", [], [])).toBe("adult");
    expect(deriveAudience(null, ["DVD U/PG/E premier"], [])).toBe("children");
    expect(deriveAudience(null, ["Children's fiction"], [])).toBe("children");
    expect(deriveAudience("E", ["Adult non-fiction"], [])).toBe("adult");
    expect(isAvailableStatus("AV item (Set: 21 Jun 2016)")).toBe(false);
  });
});

describe("spydusFetch concurrency", () => {
  it("never has more than 2 requests in flight", async () => {
    const { vi } = await import("vitest");
    const { spydusFetch } = await import("../src/lib/spydus/client");
    let inFlight = 0;
    let peak = 0;
    const mock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      peak = Math.max(peak, ++inFlight);
      await new Promise((r) => setTimeout(r, 50));
      inFlight--;
      return new Response("ok");
    });
    await Promise.all(Array.from({ length: 6 }, (_, i) => spydusFetch(`/x/${i}`)));
    mock.mockRestore();
    expect(peak).toBeLessThanOrEqual(2);
  }, 15_000);
});

describe("getLiveAvailability budget", () => {
  it("fails within the budget instead of honouring a long Retry-After", async () => {
    const { vi } = await import("vitest");
    const { getLiveAvailability } = await import("../src/lib/spydus/client");
    const mock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => new Response("busy", { status: 503, headers: { "Retry-After": "600" } }));
    const t = Date.now();
    await expect(getLiveAvailability("9104038", "184363818")).rejects.toThrow(/503/);
    expect(Date.now() - t).toBeLessThan(2_000);
    expect(mock.mock.calls.length).toBeLessThanOrEqual(3);
    mock.mockRestore();
  });
});
