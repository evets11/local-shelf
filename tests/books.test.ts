import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  bookAudience,
  repairMarc8,
  sortTitle,
  cleanTitle,
  normaliseBookGenres,
  parseFullRecord,
  parseImgUrls,
  parseListPage,
} from "../src/lib/spydus/parse";

const fx = (name: string) =>
  readFileSync(join(__dirname, "fixtures", name), "utf8");

describe("book and audiobook list pages", () => {
  it("keeps print books and large print, with label-based counts", () => {
    const p = parseListPage(fx("list-adultfic.html"), "book");
    expect(p.total).toBe(26129);
    expect(p.records).toHaveLength(20);
    const lp = p.records.find((r) => r.irn === "194014682")!;
    expect(lp).toMatchObject({
      title: "To find my mother",
      formatIcon: "Large Print",
      ean: "9780750558396",
    });
  });

  it("drops e-items and DVDs from book lists, and books from film lists", () => {
    // The unfiltered YA fixture is all print; the eAudiobook list must be junk for books.
    expect(parseListPage(fx("list-eaudio.html"), "book").records).toHaveLength(
      0,
    );
    expect(
      parseListPage(fx("list-adultfic.html"), "film").records,
    ).toHaveLength(0);
  });

  it("reads Reserved/Available/Copies by label", () => {
    const p = parseListPage(fx("list-audiocd.html"), "audiobook");
    expect(p.total).toBe(3784);
    const r = p.records.find((x) => x.title === "Big little truths")!;
    expect(r).toMatchObject({
      reserved: 1,
      available: 0,
      copies: 1,
      formatIcon: "Audiobooks",
    });
  });

  it("e-items have no counts and a BorrowBox cover", () => {
    const [r] = parseListPage(fx("list-eaudio.html"), "audiobook").records;
    expect(r).toMatchObject({
      title: "Giovanni's Room",
      formatIcon: "eAudioBook",
      available: 0,
      copies: 0,
    });
    expect(r.ean).toBe("9781802067224");
    expect(r.coverUrl).toMatch(/^https:\/\/covers\.borrowbox\.com\//);
  });
});

describe("book full records", () => {
  it("parses an adult novel", () => {
    const r = parseFullRecord(fx("full-adultfic-194015435.html"));
    expect(r).toMatchObject({
      irn: "194015435",
      brn: "9162408",
      title: "Love, after all",
      authors: ["Ewald Arenz"], // translator excluded
      isbn: "9781917764308",
      pages: 309,
      publisher: "Orenda Books",
      year: 2026,
    });
    expect(r.summary).toMatch(/^When Clara meets Elias/);
  });

  it("detects large print and strips the GMD", () => {
    const r = parseFullRecord(fx("full-adultfic-largeprint-194014682.html"));
    expect(r.title).toBe("To find my mother");
    expect(r.largePrint).toBe(true);
    expect(r.pages).toBe(444);
  });

  it("parses YA series and audience", () => {
    const r = parseFullRecord(fx("full-yafic-604173.html"));
    expect(r.series).toBe("Poisoner's moon ; 1");
    expect(r.audienceNote).toBe("Adolescent.");
    expect(normaliseBookGenres(r.subjects, "young-adult")).toEqual([
      "Fantasy",
      "Young Adult",
    ]);
  });

  it("parses junior picture books with author and artist", () => {
    const r = parseFullRecord(fx("full-juniorfic-194015297.html"));
    expect(r.authors).toEqual(["Steve Smallman", "Joëlle Dreidemy"]);
    expect(r.pages).toBe(25);
    expect(normaliseBookGenres(r.subjects, "junior")).toContain("Children's");
  });

  it("maps non-fiction subjects", () => {
    const r = parseFullRecord(fx("full-adultnf-194016155.html"));
    expect(normaliseBookGenres(r.subjects, "adult-nonfiction")).toEqual([
      "History",
      "Politics",
    ]);
    const ai = parseFullRecord(fx("full-adultnf-194015317.html"));
    expect(normaliseBookGenres(ai.subjects, "adult-nonfiction")).toEqual([
      "Science",
    ]);
  });
});

describe("audiobook full records", () => {
  it("parses a CD audiobook with narrator, discs and runtime", () => {
    const r = parseFullRecord(fx("full-audiocd-193995142.html"));
    expect(r).toMatchObject({
      title: "26 beauties",
      authors: ["James Patterson"],
      narrators: ["January LaVoy"],
      isbn: "9781038051950",
      discs: 7,
      runtimeMins: 8 * 60 + 7,
      publisher: "Bolinda Audio",
    });
    expect(normaliseBookGenres(r.subjects, null)).toEqual(["Crime"]);
  });

  it("takes the author from the statement of responsibility when Author only lists readers", () => {
    const r = parseFullRecord(fx("full-audiocd-189023057.html"));
    expect(r.title).toBe("Aldous Huxley: a BBC Radio collection");
    expect(r.authors).toEqual(["Aldous Huxley"]);
    expect(r.narrators).toEqual(["Peter Bowles"]);
  });

  it("parses an eAudiobook with series and BorrowBox cover", () => {
    const r = parseFullRecord(fx("full-eaudio-194014219.html"));
    expect(r).toMatchObject({
      title: "Murder at Gulls Nest",
      authors: ["Jess Kidd"],
      series: "Nora Breen Investigates ; 1",
      isbn: "9780571378982",
      year: 2025,
    });
    expect(r.coverUrl).toMatch(/borrowbox/);
    expect(normaliseBookGenres(r.subjects, null)).toEqual([
      "Crime",
      "Thriller",
    ]);
  });
});

describe("narrators", () => {
  it("keeps initials and ignores words ending in 'read by'", () => {
    const perf = (t: string) =>
      `<div class="row"><div class="fd-caption"><span>Main title: </span></div><div class="col"><span class="d-block">Pulp [sound recording] / Jane Doe.</span></div></div><div class="row"><div class="fd-caption"><span>Performers: </span></div><div class="col"><span class="d-block">${t}</span></div></div>`;
    expect(parseFullRecord(perf("Narrated by Samuel L. Jackson.")).narrators).toEqual(["Samuel L. Jackson"]);
    expect(parseFullRecord(perf("Widely spread by word of mouth.")).narrators).toEqual([]);
  });
  it("takes publisher and year from RDA imprints with a copyright date", () => {
    const html = `<div class="row"><div class="fd-caption"><span>Main title: </span></div><div class="col"><span class="d-block">Wildfire / Jane Doe.</span></div></div><div class="row"><div class="fd-caption"><span>Imprint: </span></div><div class="col"><span class="d-block">London : Faber &amp; Faber, 2025, ©2024.</span></div></div>`;
    expect(parseFullRecord(html)).toMatchObject({ publisher: "Faber & Faber", releaseYear: 2025 });
  });
  it("drops a leading 'by' from the statement of responsibility", () => {
    const html = `<div class="row"><div class="fd-caption"><span>Main title: </span></div><div class="col"><span class="d-block">Murder on the links [sound recording] / by Agatha Christie ; read by Hugh Fraser.</span></div></div>`;
    expect(parseFullRecord(html).authors).toEqual(["Agatha Christie"]);
  });
  it("maps 'read by the author' to the author", () => {
    const html = `<div class="row"><div class="fd-caption"><span>Main title: </span></div><div class="col"><span class="d-block"><a><span>Adam and Eve [sound recording]</span></a> / Jeffrey Archer.</span></div></div>
<div class="row"><div class="fd-caption"><span>Performers: </span></div><div class="col"><span class="d-block">Read by the author and Ben Miles.</span></div></div>`;
    expect(parseFullRecord(html)).toMatchObject({ authors: ["Jeffrey Archer"], narrators: ["Jeffrey Archer", "Ben Miles"] });
  });
});

describe("book helpers", () => {
  it("doesn't mistake headings about fiction for fiction", () => {
    expect(
      normaliseBookGenres(["Novelists, English -- Biography", "Detective and mystery stories -- History and criticism"], null),
    ).not.toContain("Crime");
  });
  it("strips GMDs anywhere in a title", () => {
    expect(
      cleanTitle(
        "Aldous Huxley [sound recording] : a BBC Radio collection / Aldous Huxley.",
      ),
    ).toBe("Aldous Huxley: a BBC Radio collection");
    expect(cleanTitle("Giovanni's Room [electronic resource]")).toBe(
      "Giovanni's Room",
    );
  });

  it("skips bibdsl placeholders for covers", () => {
    expect(
      parseImgUrls("https://x/i.asp?ISBN=&S=m**https://x/i.asp?ISBN=123&S=m**"),
    ).toEqual({
      ean: "123",
      coverUrl: "https://x/i.asp?ISBN=123&S=m",
    });
    expect(parseImgUrls("https://x/i.asp?ISBN=&S=m**")).toEqual({
      ean: null,
      coverUrl: null,
    });
  });

  it("derives audiobook audience", () => {
    expect(bookAudience("Juvenile.", [])).toEqual({
      audience: "children",
      youngAdult: false,
    });
    expect(bookAudience("Adolescent.", [])).toEqual({
      audience: "adult",
      youngAdult: true,
    });
    expect(bookAudience(null, ["Detective and mystery stories"])).toEqual({
      audience: "adult",
      youngAdult: false,
    });
  });

  it("keeps fiction and non-fiction rules apart", () => {
    expect(normaliseBookGenres(["History"], "adult-fiction")).toEqual([
      "Historical",
    ]);
    expect(normaliseBookGenres(["History"], "adult-nonfiction")).toEqual([
      "History",
    ]);
    expect(normaliseBookGenres(["Science fiction"], "adult-fiction")).toEqual([
      "Sci-Fi",
    ]);
  });
});

describe("MARC-8 repair", () => {
  it.each([
    ["Pedro AlmodÔovar", "Pedro Almodóvar"],
    ["Aki KaurismÞaki", "Aki Kaurismäki"],
    ["Alfonso CuarÔon", "Alfonso Cuarón"],
    ["Lasse HallstrÞom", "Lasse Hallström"],
    ["Roel ReinÔe", "Roel Reiné"],
    ["MiloÚs Forman", "Miloš Forman"],
    ["Gum̃undur Arnar Gum̃undsson", "Guðmundur Arnar Guðmundsson"],
    ["Halldóra Geirhars̃dóttir", "Halldóra Geirharðsdóttir"],
    ["facȧdes", "façades"],
  ])("%s -> %s", (bad, good) => {
    expect(repairMarc8(bad)).toBe(good);
  });

  it.each(["Þór Kristjánsson", "Þórdís", "Úrsula", "São Paulo", "Falcão", "Peña", "Ôtsuka", "ÉCOLE", "Lietuvė"])(
    "leaves legit %s alone",
    (ok) => {
      expect(repairMarc8(ok)).toBe(ok.normalize("NFC"));
    },
  );
});

describe("review fixes", () => {
  it("doesn't treat Non-Fiction headings as fiction", () => {
    expect(normaliseBookGenres(["Non-Fiction", "Biography", "History"], null)).toEqual(["Biography", "History"]);
    expect(normaliseBookGenres(["Nonfiction", "Self-help"], null)).toEqual(["Self-help"]);
  });

  it("sorts accented titles by their first letter", () => {
    expect(sortTitle("Élite")).toBe("élite");
    expect(sortTitle("The Ödd one")).toBe("ödd one");
    expect(sortTitle("'Salem's Lot")).toBe("salem's lot");
  });
});

describe("edition markers", () => {
  it.each([
    ["Icebreaker : Library", "Icebreaker"],
    ["Bedlam : Unabridged Edition", "Bedlam"],
    ["Blood in the Water : Unabridged, Digital Audio Library Edition", "Blood in the Water"],
    ["The Wasp Trap (Unabridged)", "The Wasp Trap"],
    ["Onyx Storm : Main Market Ed.", "Onyx Storm"],
    ["Der Fall : Ungekürzte Lesung", "Der Fall"],
  ])("%s -> %s", (raw, clean) => expect(cleanTitle(raw)).toBe(clean));

  it("keeps meaningful subtitles", () => {
    expect(cleanTitle("Library of souls")).toBe("Library of souls");
    expect(cleanTitle("Wildfire: A Novel")).toBe("Wildfire: A Novel");
    expect(cleanTitle("Matilda : 35th Anniversary Edition")).toBe("Matilda: 35th Anniversary Edition");
  });
});
