// Pure cheerio parsers for Brighton & Hove Spydus OPAC pages. No I/O here.
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { Branch, Holding, Kind, Title } from "../types";

type Cheerio$ = cheerio.CheerioAPI;

// ---------- small helpers ----------

// MARC-8 mis-decodes: the combining mark precedes its base letter and arrives as a stray
// capital ("AlmodÔovar", "KaurismÞaki", "MiloÚs"). Only fixed mid-word (after a lowercase
// letter), so legit word-initial "Þór" or "Úrsula" are untouched.
const MARC8_STRAY: Record<string, string> = { "Ô": "\u0301", "Þ": "\u0308", "Ú": "\u030C" };

export function repairMarc8(s: string): string {
  let t = s.normalize("NFC").replace(/(?<=\p{Ll})([ÔÞÚ])(\p{L})/gu, (_, x: string, b: string) => b + MARC8_STRAY[x]);
  t = t.normalize("NFD");
  // A lost eth becomes a tilde on the next consonant: "Gum̃undur" -> "Guðmundur". ñ is legit.
  t = t.replace(/(?<=\p{L})([bcdfghjklmpqrstvwxz])\u0303/gu, "ð$1");
  // A lost cedilla becomes a dot on the next vowel: "facȧdes" -> "façades".
  t = t.replace(/c([aou])\u0307/g, "ç$1");
  return t.normalize("NFC");
}

// NFC as well: the catalogue sometimes sends decomposed accents ("e" + combining diaeresis).
const clean = (s: string | undefined | null) => repairMarc8(s ?? "").replace(/\s+/g, " ").trim();

/** "28 years later: The bone temple [videorecording] / producer, ..." -> "28 years later: The bone temple" */
export function cleanTitle(raw: string): string {
  let t = clean(raw);
  const slash = t.indexOf(" / ");
  if (slash >= 0) t = t.slice(0, slash);
  // GMDs like "[videorecording]", "[sound recording]", "[text(large print)]", anywhere in the title.
  t = t.replace(/\s*\[(?:videorecording|sound recording|electronic resource|text|kit|braille|large print)[^\]]*\]/gi, "");
  t = t.replace(/\s*\[[^\]]*\]\s*$/, ""); // any other trailing GMD
  t = t.replace(/[\s:;,/.]+$/, "");
  // Pure edition markers (mostly BorrowBox eAudiobooks): "Icebreaker : Library", "X (Unabridged)".
  for (let prev = ""; prev !== t; ) {
    prev = t;
    t = t.replace(EDITION_MARKER, "").replace(/[\s:;,/.]+$/, "");
  }
  // Cataloguing puts a space before subtitle colons: "Memoir : a life" -> "Memoir: a life".
  return t.replace(/\s+:\s+/g, ": ").trim();
}

const EDITION_MARKER =
  /\s*(?::\s*|\()(?:(?:un)?abridged(?:[, ]+[\w ]*edition)?|library(?: edition)?|main market ed(?:ition)?\.?|retail|ungekürzt(?:e lesung)?)\)?\s*$/i;

/** Lowercased, leading article stripped, for sorting. */
export function sortTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+/u, "") // Unicode-aware, so "Élite" keeps its É
    .replace(/^(the|a|an)\s+/, "")
    .trim();
}

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

/** "05 Nov 2026" -> "2026-11-05" */
export function parseSpydusDate(s: string): string | null {
  const m = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/.exec(s);
  if (!m) return null;
  const mm = MONTHS[m[2].toLowerCase()];
  if (!mm) return null;
  return `${m[3]}-${mm}-${m[1].padStart(2, "0")}`;
}

/**
 * Cover + EAN/ISBN from a data-imgurls attr ("url1**url2**"). The OPAC tries URLs in order;
 * bibdsl URLs with an empty ISBN= are placeholders. e-items lead with a BorrowBox cover.
 */
export function parseImgUrls(attr: string | undefined): {
  ean: string | null;
  coverUrl: string | null;
} {
  const list = (attr ?? "").split("**").map((u) => u.trim()).filter(Boolean);
  const isbnOf = (u: string) => /[?&]ISBN=([^&]*)/i.exec(u);
  const id = list.map((u) => isbnOf(u)?.[1]).find(Boolean);
  const coverUrl = list.find((u) => { const m = isbnOf(u); return !m || !!m[1]; }) ?? null;
  let ean: string | null = null;
  try {
    ean = id ? decodeURIComponent(id) : null;
  } catch {
    // Malformed %-escape in one cover URL shouldn't sink the whole page.
  }
  return { ean, coverUrl };
}

/** Pull a set id out of any Spydus link on the page. */
export function extractSetId(html: string): string | null {
  const m = /\/(?:XHLD|FULL|PAGE|XFULL)\/OPAC\/BIBENQ\/(\d+)\//.exec(html);
  return m ? m[1] : null;
}

// ---------- list page ----------

export interface ListRecord {
  irn: string;
  /** 1-based position in the result set, used for FULL/<set>/<irn>,<pos> links. */
  position: number;
  rawTitle: string;
  title: string;
  year: number | null;
  summary: string | null; // truncated in list view
  ean: string | null;
  coverUrl: string | null;
  /** First creator shown on the card ("Baldwin, James" -> "James Baldwin"). */
  author: string | null;
  available: number;
  copies: number;
  reserved: number;
  formatIcon: string | null;
}

export interface ListPage {
  setId: string | null;
  total: number | null;
  /** First record number on this page ("Showing 101 - 200 of 1611"). */
  from: number | null;
  records: ListRecord[];
  dropped: { irn: string; title: string; reason: string }[];
}

/** Format icons we keep per kind. */
const KIND_ICONS: Record<Kind, string[]> = {
  film: ["DVDs and BluRay"],
  book: ["Book", "Large Print", "eBook"],
  audiobook: ["Audiobooks", "eAudioBook"],
};

export function isJunk(rawTitle: string, formatIcon: string | null, kind: Kind = "film"): string | null {
  if (/\[Serials|\bmagazine\b|\[periodical/i.test(rawTitle)) return "serial";
  if (!formatIcon || !KIND_ICONS[kind].includes(formatIcon)) return `format icon "${formatIcon}"`;
  return null;
}

export function parseListPage(html: string, kind: Kind = "film"): ListPage {
  const $ = cheerio.load(html);
  const showing = /Showing\s+([\d,]+)\s*-\s*([\d,]+)\s+of\s+([\d,]+)/.exec(
    $("body").text(),
  );
  const num = (s?: string) => (s ? parseInt(s.replace(/,/g, ""), 10) : null);
  const from = num(showing?.[1]);
  const records: ListRecord[] = [];
  const dropped: ListPage["dropped"] = [];

  $("fieldset.card.card-list").each((i, el) => {
    const c = $(el);
    const href =
      c.find('a[href*="/FULL/OPAC/BIBENQ/"]').first().attr("href") ?? "";
    const m = /\/FULL\/OPAC\/BIBENQ\/\d+\/(\d+),(\d+)/.exec(href);
    const irn = m?.[1] ?? c.find('input[name="SVL"]').attr("value") ?? "";
    if (!irn) return;
    const position = m ? parseInt(m[2], 10) : (from ?? 1) + i;
    const rawTitle = clean(c.find("h3.card-title").text());
    const formatIcon = c.find(".recfrmt-icon").attr("title") ?? null;
    const junk = isJunk(rawTitle, formatIcon, kind);
    if (junk) {
      dropped.push({ irn, title: rawTitle, reason: junk });
      return;
    }
    let year: number | null = null;
    let author: string | null = null;
    c.find(".recdetails span").each((_, s) => {
      const t = clean($(s).text());
      if (/^\d{4}$/.test(t)) year = parseInt(t, 10);
      else if (t && t !== "UUUU" && !author) author = uninvertName(t);
    });
    const summary = clean(c.find(".summary").text()) || null;
    const { ean, coverUrl } = parseImgUrls(
      c.find("img[data-imgurls]").attr("data-imgurls"),
    );
    // By label: some cards add "Reserved:" before Available/Copies; e-items have none.
    const counts: Record<string, number> = {};
    c.find(".availability-text").each((_, t) => {
      const n = parseInt(clean($(t).next(".availability-val").text()), 10);
      if (Number.isFinite(n)) counts[clean($(t).text()).replace(/:$/, "").toLowerCase()] = n;
    });
    records.push({
      irn,
      position,
      rawTitle,
      title: cleanTitle(rawTitle),
      year,
      author,
      summary,
      ean,
      coverUrl,
      available: counts.available ?? 0,
      copies: counts.copies ?? 0,
      reserved: counts.reserved ?? 0,
      formatIcon,
    });
  });

  return {
    setId: extractSetId(html),
    total: num(showing?.[3]),
    from,
    records,
    dropped,
  };
}

// ---------- full record ----------

export interface FullRecord {
  authors: string[];
  narrators: string[];
  isbn: string | null;
  series: string | null;
  pages: number | null;
  publisher: string | null;
  /** Raw Audience field, e.g. "BBFC code: 18.", "Juvenile.", "Adolescent." */
  audienceNote: string | null;
  largePrint: boolean;
  irn: string | null; // from the XHLD link; the page's own record
  setId: string | null;
  brn: string | null;
  rawTitle: string;
  title: string;
  summary: string | null;
  ean: string | null;
  coverUrl: string | null;
  directors: string[];
  cast: string[];
  year: number | null;
  releaseYear: number | null;
  runtimeMins: number | null;
  certificate: string | null;
  subjects: string[];
  genres: string[];
  languages: string[];
  notes: string[];
  collation: string | null;
  format: Title["format"];
  discs: number | null;
  formatIcon: string | null;
}

/** Map of caption ("Main title") -> array of d-block texts. */
function fields(
  $: Cheerio$,
): Map<string, { texts: string[]; html: cheerio.Cheerio<AnyNode> }> {
  const out = new Map<
    string,
    { texts: string[]; html: cheerio.Cheerio<AnyNode> }
  >();
  $(".fd-caption").each((_, el) => {
    const cap = clean($(el).text()).replace(/:\s*$/, "");
    const col = $(el).next();
    const blocks = col.find("span.d-block");
    const texts = blocks.length
      ? blocks.map((_, b) => clean($(b).text())).get()
      : [clean(col.text())];
    out.set(cap, { texts: texts.filter(Boolean), html: col });
  });
  return out;
}

/** "Hulce, Tom, 1953-" -> "Tom Hulce" */
export function uninvertName(name: string): string {
  const parts = name
    .replace(/\s*\([^)]*\)/g, "")
    .split(",")
    .map((p) => p.trim())
    .filter(
      (p) => p && !/^\d{4}-?(\d{4})?\.?$/.test(p) && !/^(b|d)\. \d{4}$/.test(p),
    );
  if (parts.length >= 2) return `${parts[1]} ${parts[0]}`.trim();
  return parts[0] ?? name;
}

/** "BBFC code: 18." / "12A" / "Universal" -> "18" */
export function parseCertificate(s: string): string | null {
  const m =
    /BBFC[^:]*:\s*(U|PG|12A|12|15|18|R18|E|Uc)\b/i.exec(s) ??
    /\b(?:certificate|cert\.?|rated)\s*:?\s*(U|PG|12A|12|15|18|E)\b/i.exec(s);
  if (!m) return null;
  const c = m[1].toUpperCase();
  return c === "UC" ? "U" : c;
}

/** Cert implied by a holdings collection name ("DVD 15 premier" -> "15"). U/PG/E is ambiguous. */
export function certificateFromCollection(collection: string): string | null {
  const m = /\bDVD\s+(12A|12|15|18)\b/i.exec(collection);
  return m ? m[1].toUpperCase() : null;
}

// Genre rules: every rule matching any "--" part of a subject heading adds its genre.
const GENRE_RULES: [RegExp, string][] = [
  [/\banimat|\bcartoon|\banime\b/i, "Animation"],
  [/children|\bjuvenile|\bfamily/i, "Family"],
  // Rules run per "--" part, so ^ anchors to the start of a heading or subdivision.
  [/documentar|\bfactual\b|\bbiograph|^nature\b|^wildlife\b|^travel\b/i, "Documentary"],
  [/television|\btv\b/i, "TV"],
  [/horror|zombie|vampire/i, "Horror"],
  [/science fiction|sci-?fi|dystopi/i, "Sci-Fi"],
  [/fantasy/i, "Fantasy"],
  [/thriller|suspense|\bspy\b|\bspies\b|espionage/i, "Thriller"],
  [/crime|detective|police|gangster|mystery|film noir|heist/i, "Crime"],
  [/\baction\b/i, "Action"],
  [/adventure|swashbuckl/i, "Adventure"],
  [/comed|humou?r|satir|parod|sitcom/i, "Comedy"],
  [/romanc|love stor/i, "Romance"],
  [/musical|\bmusic\b|concert|opera|ballet|\bdance\b/i, "Music"],
  [/\bwar\b|military|world war/i, "War"],
  [/western/i, "Western"],
  [/\bhistor(?:y|ical)\b|^period\b|\bbiopic|costume drama/i, "History"],
  [/foreign|world cinema|subtitled/i, "World Cinema"],
  [/\bsport/i, "Sport"],
  [/lgbt|gay|lesbian|queer/i, "LGBTQ+"],
  [/classic|\bcult\b/i, "Classics"],
  [/drama|melodrama/i, "Drama"],
];

export function normaliseGenres(subjects: string[]): string[] {
  const out = new Set<string>();
  for (const s of subjects) {
    // Personal-name headings ("Presley, Elvis, 1935-1977") aren't genres.
    if (PERSON_HEADING.test(s)) continue;
    // "Children's -- Animated Feature": each "--" part can carry its own genre.
    for (const part of s.split(/\s*--\s*/)) {
      for (const [re, g] of GENRE_RULES) {
        if (re.test(part)) out.add(g);
      }
    }
  }
  return [...out].sort();
}

export function parseFullRecord(html: string): FullRecord {
  const $ = cheerio.load(html);
  const f = fields($);
  const get = (k: string) => f.get(k)?.texts ?? [];

  const xhld = /\/XHLD\/OPAC\/BIBENQ\/(\d+)\/(\d+)/.exec(html);
  const titleBlock = f.get("Main title");
  const rawTitle =
    clean(titleBlock?.html.find("a").first().text()) ||
    clean(get("Main title")[0]);

  // Directors: Author entries with ", director"; fall back to Credits.
  const directors: string[] = [];
  f.get("Author")
    ?.html.find("span.d-block")
    .each((_, el) => {
      const name = clean($(el).find("a").first().text());
      const role = clean($(el).text()).slice(name.length);
      if (/director/i.test(role) && name) directors.push(uninvertName(name));
    });
  const credits = get("Credits").join(" ");
  if (!directors.length) {
    // "Credits: director, Nia DaCosta; writer, ..."; role must start the part, so
    // "art director" and "director of photography" don't count.
    for (const part of credits.replace(/^(?:\s*credits:\s*)+/i, "").split(/\s*;\s*/)) {
      const m = /^(?:directors?|directed by)(?! of\b)[,:]?\s+(.+?)\.?$/i.exec(part);
      if (m) for (const n of m[1].split(/\s*(?:,| and | & )\s*/)) if (n) directors.push(clean(n));
    }
  }

  // Cast: "Cast: Cast: Ralph Fiennes, ..., Cillian Murphy."
  let cast: string[] = [];
  const perf = get("Performers").join("; ");
  if (perf) {
    const body = perf.replace(
      /^(?:\s*(?:cast|voices?|presenters?|narrators?)\s*:\s*)+/i,
      "",
    );
    cast = body
      .replace(/\.\s*$/, "")
      .split(/\s*[,;]\s*/)
      .map((s) =>
        s
          .replace(/^(?:and\s+)/i, "")
          .replace(/\s*\(.*?\)\s*$/, "")
          .trim(),
      )
      .filter((s) => s && s.length < 60 && !/^cast:?$/i.test(s));
  }
  if (!cast.length) {
    f.get("Author")
      ?.html.find("span.d-block")
      .each((_, el) => {
        const name = clean($(el).find("a").first().text());
        const role = clean($(el).text()).slice(name.length);
        if (/actor|performer|voice|narrator|presenter/i.test(role) && name)
          cast.push(uninvertName(name));
      });
  }
  cast = [...new Set(cast)];

  const imprint = get("Imprint").join(" ");
  // Last publication year; a copyright/phonogram year ("©2024", "℗2023", "c2024") only if that's all there is.
  const years = [...imprint.matchAll(/(^|[^\d])(©|℗|\bc|\bp)?\s?(\d{4})(?!\d)/gu)].map((m) => ({
    year: parseInt(m[3], 10),
    copyright: Boolean(m[2]),
  }));
  const pubYear = years.filter((y) => !y.copyright).at(-1) ?? years.at(-1);
  const releaseYear = pubYear ? pubYear.year : null;

  const notes = get("Notes");
  const notesText = notes.join(" ");
  const madeM = /Made in (\d{4})/i.exec(notesText);
  const year = madeM ? parseInt(madeM[1], 10) : releaseYear;

  const collation = get("Collation").join(" ") || null;
  // "(109 min.)", "(8 hr., 7 min.)", "(10 hr.)"
  const rtM = /(\d+)\s*hrs?\.?,?\s*(?:(\d+)\s*min)?/i.exec(collation ?? "");
  let runtimeMins: number | null = null;
  if (rtM) runtimeMins = parseInt(rtM[1], 10) * 60 + (rtM[2] ? parseInt(rtM[2], 10) : 0);
  else {
    const m =
      /(?:approx\.?\s*)?(\d+)\s*min/i.exec(collation ?? "") ??
      /(\d+)\s*min(?:s|utes)?\b/i.exec(notesText);
    if (m) runtimeMins = parseInt(m[1], 10);
  }

  const certificate =
    parseCertificate(get("Audience").join(" ")) ?? parseCertificate(notesText);

  const subjects = get("Subject");
  const languages = [
    ...new Set(
      get("Language")
        .flatMap((l) => l.split(/\s*(?:,|;| and )\s*/))
        .map((l) => l.replace(/\.$/, ""))
        .filter(Boolean),
    ),
  ];

  // Discs: "3 disc(s)" in notes, or "2 DVDs" / "3 videodiscs" in collation.
  let discs: number | null = null;
  const dM =
    /(\d+)\s*disc\(s\)/i.exec(notesText) ??
    /(\d+)\s*(?:DVDs?|CDs?|videodiscs?|sound discs?|audio discs?|discs?|Blu-?ray(?: discs?)?)\b/i.exec(
      collation ?? "",
    );
  if (dM) discs = parseInt(dM[1], 10);

  const sysDetails = get("System details").join(" ");
  const strongBlu = /blu-?\s?ray/i.test(
    `${rawTitle} ${collation ?? ""} ${sysDetails}`,
  );
  const noteBlu =
    /blu-?\s?ray/i.test(notesText) && !/\bDVD\b/i.test(collation ?? "");
  const boxSet =
    /box(?:ed)?[\s-]?set/i.test(
      `${rawTitle} ${collation ?? ""} ${notesText}`,
    ) || (discs ?? 0) > 2;
  const format: Title["format"] =
    strongBlu || noteBlu ? "Blu-ray" : boxSet ? "DVD box set" : "DVD";

  const summary =
    clean(
      $("#divtabSUMMARY")
        .find("span.d-block")
        .map((_, s) => $(s).text())
        .get()
        .join("\n\n"),
    ) || null;

  // ---- book / audiobook fields ----
  const authors: string[] = [];
  const narrators: string[] = [];
  f.get("Author")?.html.find("span.d-block").each((_, el) => {
    const name = clean($(el).find("a").first().text());
    if (!name) return;
    const role = clean($(el).text()).slice(name.length).toLowerCase();
    if (/narrator|reader|voice actor/.test(role)) narrators.push(uninvertName(name));
    else if (!role || /author|artist|illustrator|writer/.test(role)) authors.push(uninvertName(name));
  });
  // "Narrated by January LaVoy." / "Read by X and Y." in Performers or Notes.
  // Names can contain initials ("Samuel L. Jackson"), so a single capital + "." doesn't end them.
  const readBy = /\b(?:[Nn]arrated|[Rr]ead) by ((?:[A-Z]\.\s*|[^.;])+)/.exec([...get("Performers"), ...notes].join(" "));
  if (readBy)
    for (const n of readBy[1].split(/\s*(?:,| and | & )\s*/))
      if (n && !/full cast/i.test(n)) narrators.push(clean(n));
  if (!authors.length) {
    // Statement of responsibility: "Title / Steve Smallman, Joëlle Dreidemy."
    const sor = /\s\/\s(.+)$/.exec(get("Main title")[0] ?? "")?.[1];
    if (sor && !/producer|director/i.test(sor))
      for (const n of sor.replace(/\.$/, "").split(/\s*;\s*/)[0].split(/\s*(?:,| and | & )\s*/))
        if (n && !/translated|illustrated|edited/i.test(n)) authors.push(clean(n.replace(/^(?:(?:written|text) )?by\s+/i, "")));
  }

  const isbn = /\b(97[89]\d{10}|\d{9}[\dX])\b/.exec(get("ISBN").join(" "))?.[1] ?? null;
  const series =
    clean((get("Series")[0] ?? get("Series title")[0] ?? "").replace(/\.\s*$/, "")) || null;
  const pagesM = /(\d+)\s+(?:unnumbered\s+)?pages/i.exec(collation ?? "");
  const pages = pagesM ? parseInt(pagesM[1], 10) : null;
  // "London : Orenda Books, 2026." / "London : Faber & Faber, 2025, ©2024." -> the publisher
  const imprintNoDates = imprint.replace(/(?:[,\s]*\[?(?:©|℗|\bc|\bp)?\s?\d{4}\]?)+\.?\s*$/u, "");
  const pubM = /:\s*([^:]+?),?\s*$/.exec(imprintNoDates);
  const publisher = pubM ? clean(pubM[1]).replace(/,$/, "") || null : null;
  const audienceNote = clean(get("Audience").join(" ")) || null;
  const largePrint = /large print|large type/i.test(`${rawTitle} ${collation ?? ""} ${subjects.join(" ")}`);

  const { ean, coverUrl } = parseImgUrls(
    $("img[data-imgurls]").first().attr("data-imgurls"),
  );
  const brn = clean(get("BRN")[0]) || null;

  return {
    authors: [...new Set(authors)],
    // "Read by the author" -> the author's name.
    narrators: [
      ...new Set(narrators.map((n) => (/^(?:the )?authors?$/i.test(n) ? authors[0] : n)).filter(Boolean)),
    ],
    isbn,
    series,
    pages,
    publisher,
    audienceNote,
    largePrint,
    irn: xhld?.[2] ?? null,
    setId: xhld?.[1] ?? extractSetId(html),
    brn,
    rawTitle,
    title: cleanTitle(rawTitle),
    summary,
    ean,
    coverUrl,
    directors: [...new Set(directors)],
    cast,
    year,
    releaseYear,
    runtimeMins,
    certificate,
    subjects,
    genres: normaliseGenres(subjects),
    languages,
    notes,
    collation,
    format,
    discs,
    // Full pages show the format as text in .recfrmt (list cards use an icon title).
    formatIcon: $(".recfrmt-icon").attr("title") ?? (clean($(".recfrmt").first().text()) || null),
  };
}

// ---------- holdings (XHLD fragment) ----------

/** Only a plain "Available" status means on the shelf. "AV item ..." etc. do not. */
export function isAvailableStatus(status: string): boolean {
  return /^available\b/i.test(status.trim());
}

const cellSpans = ($: Cheerio$, td: cheerio.Cheerio<AnyNode>) => {
  const blocks = td.find("span.d-block");
  const texts = blocks.length ? blocks.map((_, b) => clean($(b).text())).get() : [clean(td.text())];
  return texts.filter(Boolean);
};

export function parseHoldings(html: string): Holding[] {
  const $ = cheerio.load(html);
  const out: Holding[] = [];
  $("table tbody tr").each((_, tr) => {
    // Index-based: empty cells are bare <td></td> with no data-caption.
    const tds = $(tr).children("td");
    if (tds.length < 4) return;
    // Location can be "Jubilee Library" + "Jubilee Library Store"; status can stack
    // several flags, e.g. "AV item (Set: ...)" + "On loan - Due: 07 Nov 2026".
    const [branch = "", subLocation = null] = cellSpans($, tds.eq(0));
    const statuses = cellSpans($, tds.eq(3));
    const due = /On loan - Due:\s*(\d{1,2} \w{3} \d{4})/i.exec(statuses.join(" "));
    out.push({
      branch: branch as Branch,
      subLocation,
      collection: clean(tds.eq(1).text()),
      callNumber: clean(tds.eq(2).text()),
      status: statuses.join("; "),
      available: statuses.some(isAvailableStatus),
      dueDate: due ? parseSpydusDate(due[1]) : null,
    });
  });
  return out;
}

/** True if the fragment is a holdings response for this IRN. */
export function isHoldingsResponse(html: string, irn: string): boolean {
  return /<th[^>]*>Location<\/th>/.test(html) && html.includes(`/${irn}?`);
}

const ADULT_COLLECTION = /\b(?:12A?|15|18)\b|\badult\b/i;
const CHILD_COLLECTION = /junior|child|\bkids?\b/i;
// "DVD U/PG/E" shelves by certificate, so it's a weak hint, not a children's collection.
const U_PG_COLLECTION = /U\/PG/i;
// "family drama", "British children's comedy", "Animated adventure"
const FAMILY_BLURB =
  /\b(?:family|children's|kids'?) (?:film|drama|comedy|adventure|fantasy|musical|movie|favourite|tale|classic|story|novel)|\banimated\b/i;
// Library film categories that lean grown-up even at U/PG ("Feature -- Drama", "-- Classic").
// Comedy, Adventure, Animated etc. stay family-friendly.
const ADULT_CATEGORY =
  /^(?:feature|television)\s*--\s*(?:drama|classic|modern classic|foreign|world|thriller|documentary|horror|crime|romance|war|cult)|^special interest\b|^music\s*--/i;

/**
 * Kids-profile audience. Any copy in an adult collection (DVD 12/15/18, Adult non-fiction)
 * or an adult cert means adult. On the U/PG/E shelf, grown-up categories (Amadeus is
 * "Feature -- Drama") rule a film out unless the blurb says it's a family/children's film;
 * anything else there counts as children's.
 */
export function deriveAudience(
  certificate: string | null,
  collections: string[],
  genres: string[],
  subjects: string[] = [],
  summary: string | null = null,
): Title["audience"] {
  const cols = collections.filter(Boolean);
  if (cols.some((c) => ADULT_COLLECTION.test(c))) return "adult";
  if (certificate && ["12", "12A", "15", "18", "R18"].includes(certificate)) return "adult";
  if (cols.some((c) => CHILD_COLLECTION.test(c))) return "children";
  if (subjects.some((s) => /^children'?s\b/i.test(s))) return "children";
  if (genres.includes("Family") || genres.includes("Animation")) return "children";
  if (!cols.some((c) => U_PG_COLLECTION.test(c))) return null;
  if (FAMILY_BLURB.test(summary ?? "")) return "children";
  return subjects.some((s) => ADULT_CATEGORY.test(s)) ? null : "children";
}

// ---------- books / audiobooks ----------

const NON_FICTION = /non-?\s?fiction/i;

/** "Presley, Elvis, 1935-1977" (not "World War, 1939-1945 -- Fiction"). */
const PERSON_HEADING = /^[^,]+,[^,]+,\s*\d{4}-/;

// Book genre rules, run per "--" part of each subject heading. Fiction-only rules apply
// when the record is fiction (by query bucket or a "fiction"/"stories" heading).
const BOOK_GENRE_RULES: [RegExp, string, "fiction" | "nonfiction" | "any"][] = [
  [/crime|detective|mystery|mysteries|murder|police procedural/i, "Crime", "fiction"],
  [/thriller|suspense|espionage|spy stories/i, "Thriller", "fiction"],
  [/romance|love stories|romantic/i, "Romance", "fiction"],
  [/fantasy/i, "Fantasy", "fiction"],
  [/science f\w*ction|sci-?fi|dystopi/i, "Sci-Fi", "fiction"],
  [/horror|ghost stories/i, "Horror", "fiction"],
  [/historical fiction|historical novel|^saga$|^history$|^world war/i, "Historical", "fiction"],
  [/literary fiction|^literary$|^classics$/i, "Literary", "fiction"],
  [/short stories/i, "Short stories", "any"],
  [/poetry|poems/i, "Poetry", "any"],
  [/graphic novels?|comic books|comics/i, "Graphic novels", "any"],
  [/biograph|autobiograph|memoir/i, "Biography", "nonfiction"],
  [/\bhistory\b/i, "History", "nonfiction"],
  [/^(?!.*fiction).*(?:\bscience\b|physics|chemistry|biology|mathematics|astronomy|artificial intelligence|computers?\b|technology)/i, "Science", "nonfiction"],
  [/^nature\b|natural history|^animals\b|wildlife|^birds\b|^plants\b|gardening|ecology|climat/i, "Nature", "nonfiction"],
  [/^travel\b|description and travel|guidebooks/i, "Travel", "nonfiction"],
  [/cook|recipes|baking|^food\b/i, "Cookery", "nonfiction"],
  [/\bhealth\b|medicine|fitness|nutrition|wellbeing|mental illness/i, "Health", "nonfiction"],
  [/self-help|self-improvement|personal development|mindfulness|happiness/i, "Self-help", "nonfiction"],
  [/politic|government|elections?\b/i, "Politics", "nonfiction"],
  [/^art\b|^arts\b|painting|photography|architecture|^design\b/i, "Art", "nonfiction"],
  [/^music\b|musicians|popular music|rock music/i, "Music", "nonfiction"],
  [/^sports?\b|football|cricket|cycling|athletics/i, "Sport", "nonfiction"],
  [/humou?r|^comedy\b|wit and/i, "Humour", "any"],
];

/**
 * A subject heading that says the work is fiction. Whole words only, and not headings about
 * fiction ("Detective and mystery stories -- History and criticism", "Novelists -- Biography",
 * "Romance languages") or about a person.
 */
function isFictionHeading(s: string): boolean {
  if (NON_FICTION.test(s) || PERSON_HEADING.test(s)) return false;
  if (/criticism|biograph|languages|grammar|study and teaching|authorship/i.test(s)) return false;
  return /\bf\w*ction\b|\bstories\b|\bnovels?\b|\bromances?\b|\bthrillers?\b|^sagas?$/i.test(s);
}

export type BookBucket = "adult-fiction" | "adult-nonfiction" | "young-adult" | "junior" | null;

export function normaliseBookGenres(subjects: string[], bucket: BookBucket): string[] {
  const fiction =
    bucket === "adult-fiction" ||
    bucket === "young-adult" ||
    bucket === "junior" ||
    (bucket !== "adult-nonfiction" && subjects.some(isFictionHeading));
  const out = new Set<string>();
  for (const s of subjects) {
    if (PERSON_HEADING.test(s)) continue; // personal-name headings
    for (const part of s.split(/\s*--\s*/))
      for (const [re, g, scope] of BOOK_GENRE_RULES)
        if (scope === "any" || (scope === "fiction") === fiction) if (re.test(part)) out.add(g);
  }
  if (bucket === "young-adult") out.add("Young Adult");
  if (bucket === "junior") out.add("Children's");
  return [...out].sort();
}

/** Audience for audiobooks (no query bucket): the Audience note or juvenile subject headings. */
export function bookAudience(audienceNote: string | null, subjects: string[]): {
  audience: Title["audience"];
  youngAdult: boolean;
} {
  const note = audienceNote ?? "";
  if (/adolescent|young adult|teen/i.test(note) || subjects.some((s) => /young adult|teenage fiction/i.test(s)))
    return { audience: "adult", youngAdult: true };
  if (/juvenile|preschool|primary|children/i.test(note) || subjects.some((s) => /juvenile|children's/i.test(s)))
    return { audience: "children", youngAdult: false };
  return { audience: "adult", youngAdult: false };
}
