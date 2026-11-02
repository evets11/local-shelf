import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseBorrowBox, pickLibbyMatch } from "../src/lib/eloans";
import { buildTitle } from "../src/lib/spydus/build";
import { parseFullRecord, parseListPage } from "../src/lib/spydus/parse";
import { borrowBoxIdFromCover, isBorrowBoxId } from "../src/lib/spydus/urls";
import { matchesPrefs, DEFAULT_PREFS } from "../src/lib/prefs";

const fx = (name: string) =>
  readFileSync(join(__dirname, "fixtures", name), "utf8");

describe("eBooks", () => {
  it("keeps eBooks on book lists, with a BorrowBox cover id", () => {
    const p = parseListPage(fx("list-ebook.html"), "book");
    expect(p.records).toHaveLength(20);
    expect(p.records.every((r) => r.formatIcon === "eBook")).toBe(true);
    expect(p.records.every((r) => borrowBoxIdFromCover(r.coverUrl))).toBe(true);
    // ...but not on audiobook lists.
    expect(
      parseListPage(fx("list-ebook.html"), "audiobook").records,
    ).toHaveLength(0);
  });

  it("builds an eBook title with no holdings", () => {
    const rec = parseListPage(fx("list-ebook.html"), "book").records.find(
      (r) => r.irn === "194014234",
    )!;
    const full = parseFullRecord(fx("full-ebook-194014234.html"));
    const t = buildTitle(
      "book",
      rec,
      null,
      full,
      undefined,
      null,
      null,
      "2026-11-02T00:00:00Z",
    );
    expect(t).toMatchObject({
      title: "Twenty Years Together",
      authors: ["Tom Rob Smith"],
      format: "eBook",
      audience: "adult",
      holdings: [],
      branches: [],
    });
  });

  it("filters books by format", () => {
    const base = {
      available: 0,
      availableAt: [],
      branches: [],
      audience: "adult" as const,
    };
    const pick = (bookFormat: typeof DEFAULT_PREFS.bookFormat) =>
      (["Book", "Large print", "eBook"] as const).filter((format) =>
        matchesPrefs({ ...base, format }, { ...DEFAULT_PREFS, bookFormat }),
      );
    expect(pick("all")).toEqual(["Book", "Large print", "eBook"]);
    expect(pick("ebook")).toEqual(["eBook"]);
    expect(pick("print")).toEqual(["Book", "Large print"]);
  });
});

describe("BorrowBox", () => {
  it("reads the id from a Spydus cover URL", () => {
    expect(
      borrowBoxIdFromCover(
        "https://covers.borrowbox.com/backend/covers/BOL_8384306?w=427",
      ),
    ).toBe("BOL_8384306");
    expect(
      borrowBoxIdFromCover(
        "https://www.bibdsl.co.uk/xmla/image-service.asp?ISBN=1",
      ),
    ).toBeNull();
    expect(borrowBoxIdFromCover(null)).toBeNull();
    expect(isBorrowBoxId("CGB_7247542")).toBe(true);
    expect(isBorrowBoxId("../etc")).toBe(false);
  });

  it("parses loan status from a product page", () => {
    const html = fx("borrowbox-product-CGB_7247542.html");
    expect(parseBorrowBox(html, "CGB_7247542")).toEqual({
      id: "CGB_7247542",
      available: false,
      nextAvailable: "2026-12-23",
    });
    // A page for some other product isn't trusted.
    expect(parseBorrowBox(html, "BOL_8384306")).toBeNull();
    expect(parseBorrowBox("<html></html>", "CGB_7247542")).toBeNull();
  });

  it("reads available products", () => {
    const html = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
      {
        props: {
          pageProps: {
            product: {
              productId: "BOL_1234",
              availability: { availabilityStatus: "AVAILABLE" },
            },
          },
        },
      },
    )}</script>`;
    expect(parseBorrowBox(html, "BOL_1234")).toEqual({
      id: "BOL_1234",
      available: true,
      nextAvailable: null,
    });
  });
});

describe("Libby matching", () => {
  const item = (over: object) => ({
    id: "1",
    title: "Wild Dark Shore",
    type: { id: "ebook" },
    firstCreatorName: "Charlotte McConaghy",
    formats: [{ identifiers: [{ type: "ISBN", value: "9781837265930" }] }],
    isOwned: true,
    ...over,
  });
  const q = {
    type: "ebook" as const,
    isbn: "9781837265930",
    title: "Wild Dark Shore",
    author: "Charlotte McConaghy",
  };

  it("matches on ISBN", () => {
    expect(pickLibbyMatch([item({ title: "Something else" })], q)?.id).toBe(
      "1",
    );
  });

  it("matches on title, surname and type without an ISBN hit", () => {
    const items = [
      item({
        id: "2",
        formats: [],
        title: "Wild Dark Shore: A Novel",
        firstCreatorName: "McConaghy, Charlotte",
      }),
    ];
    expect(pickLibbyMatch(items, q)?.id).toBe("2");
  });

  it("never picks a different book, author or format", () => {
    const noIsbn = { formats: [] };
    expect(
      pickLibbyMatch(
        [item({ ...noIsbn, title: "Wild Dark Shores of Mars" })],
        q,
      ),
    ).toBeNull();
    expect(
      pickLibbyMatch(
        [item({ ...noIsbn, firstCreatorName: "Someone Else" })],
        q,
      ),
    ).toBeNull();
    expect(pickLibbyMatch([item({ type: { id: "audiobook" } })], q)).toBeNull();
    expect(pickLibbyMatch([item({ isOwned: false })], q)).toBeNull();
  });
});
