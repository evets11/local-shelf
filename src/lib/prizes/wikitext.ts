// Just enough wikitext parsing to read prize tables (winners, shortlists, longlists) from
// Wikipedia pages. Pure, no I/O. Pages differ a lot, so this is deliberately forgiving:
// rows it can't read are skipped rather than guessed.

export type Stage = "winner" | "shortlist" | "longlist";

export interface WikiRow {
  /** Prize year from a Year column or the section heading; null if neither has one. */
  year: number | null;
  /** Displayed author names, then any link targets (which fix typos in the display text). */
  authors: string[];
  title: string;
  /** From a Result/Award column, else row colour; null when the row says nothing. */
  stage: Stage | null;
  /** Category or result text, e.g. "Older Fiction" or "Children's fiction shortlist". */
  note: string;
}

/** Sort order: winners first. */
export const STAGE_ORDER: Record<Stage, number> = {
  winner: 0,
  shortlist: 1,
  longlist: 2,
};
export const betterStage = (a: Stage, b: Stage): Stage =>
  STAGE_ORDER[a] <= STAGE_ORDER[b] ? a : b;

/** Index of the `}}` closing the `{{` at `start`, honouring nesting; -1 if unclosed. */
function closeBraces(s: string, start: number): number {
  let depth = 0;
  for (let i = start; i < s.length - 1; i++) {
    if (s[i] === "{" && s[i + 1] === "{") {
      depth++;
      i++;
    } else if (s[i] === "}" && s[i + 1] === "}") {
      depth--;
      i++;
      if (depth === 0) return i - 1;
    }
  }
  return -1;
}

/** Split on `sep` only outside [[links]] and {{templates}}. */
export function splitTop(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < s.length; i++) {
    const two = s.slice(i, i + 2);
    if (two === "[[" || two === "{{") {
      depth++;
      i++;
    } else if ((two === "]]" || two === "}}") && depth > 0) {
      depth--;
      i++;
    } else if (depth === 0 && s.startsWith(sep, i)) {
      out.push(s.slice(from, i));
      i += sep.length - 1;
      from = i + 1;
    }
  }
  out.push(s.slice(from));
  return out;
}

/** Comments and footnotes go first: refs can hold pipes and templates that confuse everything else. */
export function stripNoise(s: string): string {
  return s
    .replace(/<!--[\s\S]*?(?:-->|$)/g, "")
    .replace(/<ref\b[^>]*\/>/gi, "")
    .replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, "");
}

function templateArgs(inner: string): {
  name: string;
  pos: string[];
  named: Record<string, string>;
} {
  const [name, ...rest] = splitTop(inner, "|");
  const pos: string[] = [];
  const named: Record<string, string> = {};
  for (const a of rest) {
    const m = /^\s*([\w-]+)\s*=([\s\S]*)$/.exec(a);
    if (m) named[m[1].toLowerCase()] = m[2].trim();
    else pos.push(a.trim());
  }
  return { name: name.trim().toLowerCase().replace(/_/g, " "), pos, named };
}

/** {{sortname|First|Last|link}} as a link, so the target can fix a misspelt display name. */
function sortname(pos: string[], named: Record<string, string>): string {
  const first = named.first ?? named["1"] ?? pos[0] ?? "";
  const last = named.last ?? named["2"] ?? pos[1] ?? "";
  const shown = `${first.trim()} ${last.trim()}`.trim();
  const link = named.link ?? pos[2];
  return link && link.trim() && !/^\s*nolink\s*$/i.test(link)
    ? `[[${link.trim()}|${shown}]]`
    : shown;
}

const STAGE_TEMPLATES: Record<string, string> = {
  won: "Winner",
  win: "Winner",
  winner: "Winner",
  sho: "Shortlist",
  shortlisted: "Shortlist",
  longlisted: "Longlist",
  nom: "Nominated",
};

/** Replace templates with their visible text (or nothing), innermost first. */
export function expandTemplates(s: string): string {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const open = s.indexOf("{{", i);
    if (open < 0) {
      out += s.slice(i);
      break;
    }
    const close = closeBraces(s, open);
    if (close < 0) {
      out += s.slice(i);
      break;
    }
    out += s.slice(i, open);
    const { name, pos, named } = templateArgs(
      expandTemplates(s.slice(open + 2, close)),
    );
    if (name === "sortname") out += sortname(pos, named);
    else if (name === "sort") out += pos[1] ?? pos[0] ?? "";
    else if (name === "nowrap" || name === "nobold" || name === "noitalic")
      out += pos[0] ?? "";
    // Interlanguage link: {{ill|English name|lang|Foreign name}}.
    else if (name === "ill" || name === "interlanguage link")
      out += pos[0] ? `[[${pos[0]}]]` : "";
    else if (name in STAGE_TEMPLATES) out += STAGE_TEMPLATES[name];
    // Footnotes, flags, original-language titles, citations and the like add nothing we show.
    i = close + 2;
  }
  return out;
}

/** Link targets in a cell, minus disambiguation like "(author)". */
function linkTargets(s: string): string[] {
  return [...s.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)]
    .map((m) =>
      m[1]
        .replace(/_/g, " ")
        .replace(/\s*\([^)]*\)\s*$/, "")
        .trim(),
    )
    .filter((t) => t && !t.includes(":"));
}

/** Visible text: links to their labels, no bold/italic quotes or HTML, collapsed spaces. */
export function plain(s: string): string {
  return s
    .replace(/\[\[(?:[^\]|]+\|)?([^\]]*)\]\]/g, "$1")
    .replace(/\[https?:\/\/\S+\s+([^\]]*)\]/g, "$1")
    .replace(/'{2,}/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

interface Cell {
  header: boolean;
  attrs: string;
  /** Templates expanded, links kept. */
  text: string;
  rowspan: number;
}

function parseCell(raw: string, header: boolean): Cell {
  // "attrs | content", where the pipe is a top-level single pipe.
  const parts = splitTop(raw, "|");
  const hasAttrs =
    parts.length > 1 &&
    /^\s*(?:[\w-]+\s*=|$)/.test(parts[0]) &&
    !/\[\[|\{\{/.test(parts[0]);
  const attrs = hasAttrs ? parts[0] : "";
  const content = hasAttrs ? parts.slice(1).join("|") : raw;
  const span = /rowspan\s*=\s*"?(\d+)/i.exec(attrs);
  return {
    header,
    attrs,
    text: expandTemplates(content).trim(),
    rowspan: span ? Math.max(1, Number(span[1])) : 1,
  };
}

interface Row {
  attrs: string;
  cells: Cell[];
}

interface Table {
  heading: string;
  rows: Row[];
}

/** Every `{| … |}` table, with the nearest heading above it. */
export function parseTables(wikitext: string): Table[] {
  const lines = stripNoise(wikitext).split("\n");
  const tables: Table[] = [];
  let heading = "";
  let table: Table | null = null;
  let row: Row | null = null;
  // Assigned inside flushCells, which TS can't see from here.
  let last = null as Cell | null;
  // Raw cell text gathered across lines; templates can span lines, so cells are parsed on flush.
  let pending: { raw: string; header: boolean }[] = [];

  const flushCells = () => {
    if (!row) row = { attrs: "", cells: [] };
    for (const p of pending)
      row.cells.push((last = parseCell(p.raw, p.header)));
    pending = [];
  };
  const flushRow = () => {
    flushCells();
    if (table && row && row.cells.length) table.rows.push(row);
    row = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!table) {
      const h = /^(={2,6})\s*(.*?)\s*\1\s*$/.exec(line);
      if (h) heading = plain(expandTemplates(h[2]));
      if (line.startsWith("{|")) {
        table = { heading, rows: [] };
        row = null;
        pending = [];
      }
      continue;
    }
    if (line.startsWith("|}")) {
      flushRow();
      tables.push(table);
      table = null;
    } else if (line.startsWith("|-")) {
      flushRow();
      row = { attrs: line.slice(2), cells: [] };
    } else if (line.startsWith("|+")) {
      continue; // caption
    } else if (line.startsWith("!") || line.startsWith("|")) {
      const header = line.startsWith("!");
      const body = line.slice(1);
      for (const c of splitTop(body, header ? "!!" : "||")) {
        // "!" rows may also use "||" between cells.
        for (const c2 of header ? splitTop(c, "||") : [c])
          pending.push({ raw: c2, header });
      }
    } else if (pending.length) {
      pending[pending.length - 1].raw += "\n" + rawLine;
    } else if (last && line) {
      last.text += " " + plain(expandTemplates(line));
    }
  }
  return tables;
}

const COLS: Record<string, RegExp> = {
  year: /^year\b/,
  author:
    /^(?:author|writer|authors?\s*\(s\)|author\(s\)|author \/ illustrator)/,
  title: /^(?:title|book|work)\b/,
  result: /^(?:result|award|status|outcome)\b/,
  category: /^(?:category|section)\b/,
};

const headerName = (c: Cell) => plain(c.text).toLowerCase();

function stageFrom(text: string): Stage | null {
  const t = text.toLowerCase();
  if (/\b(?:winner|won|medal(?:list)?)\b/.test(t) && !/\bshort/.test(t))
    return "winner";
  if (/short|finalist/.test(t)) return "shortlist";
  if (/long/.test(t)) return "longlist";
  return null;
}

/** Row colours some pages use instead of a Result column (e.g. per-year Booker pages). */
function stageFromColour(attrs: string): Stage | null {
  const bg = /background(?:-color)?\s*:\s*([#\w]+)/i
    .exec(attrs)?.[1]
    ?.toLowerCase();
  if (!bg) return null;
  if (bg === "gold" || bg === "#faeb86" || bg === "#ffd700") return "winner";
  if (bg === "lightgrey" || bg === "lightgray" || bg === "#d3d3d3")
    return "shortlist";
  return null;
}

const yearIn = (s: string) => {
  const m = /\b(19|20)\d{2}\b/.exec(plain(s));
  return m ? Number(m[0]) : null;
};

/**
 * Rows from every table that has Author and Title columns. Rowspans are carried down, and
 * header cells inside data rows (`! rowspan=6 | 2025`) count as data.
 */
export function prizeRows(wikitext: string): WikiRow[] {
  const out: WikiRow[] = [];
  for (const table of parseTables(wikitext)) {
    const headIdx = table.rows.findIndex(
      (r) => r.cells.length > 1 && r.cells.every((c) => c.header),
    );
    if (headIdx < 0) continue;
    const names = table.rows[headIdx].cells.map(headerName);
    const col = Object.fromEntries(
      Object.entries(COLS).map(([k, re]) => [
        k,
        names.findIndex((n) => re.test(n)),
      ]),
    ) as Record<keyof typeof COLS, number>;
    if (col.author < 0 || col.title < 0) continue;
    const headingYear = yearIn(table.heading);

    // Cells still spanning down from earlier rows, by column.
    const spans = new Map<number, { cell: Cell; left: number }>();
    for (const r of table.rows.slice(headIdx + 1)) {
      const cells: Cell[] = [];
      const queue = [...r.cells];
      for (let i = 0; i < names.length && (queue.length || spans.size); i++) {
        const s = spans.get(i);
        if (s) {
          cells.push(s.cell);
          if (--s.left === 0) spans.delete(i);
          continue;
        }
        const c = queue.shift();
        if (!c) break;
        cells.push(c);
        if (c.rowspan > 1) spans.set(i, { cell: c, left: c.rowspan - 1 });
      }
      const at = (k: keyof typeof COLS) =>
        col[k] >= 0 ? cells[col[k]] : undefined;
      const authorCell = at("author");
      const titleCell = at("title");
      if (!authorCell || !titleCell) continue;

      // The first title only: translated titles add the original after a <br>.
      const titleText = plain(titleCell.text.split(/<br\s*\/?>/i)[0]).replace(
        /\s+([:;,.])/g,
        "$1",
      );
      // "Gavin Pretor-Pinney with William Grill (illus.)": the first author is enough to match.
      const authorText = authorCell.text.split(
        /\s+(?:with|and|&|illus(?:trated)?\.? by)\s+|,\s*illus/i,
      )[0];
      const shown = plain(authorText).replace(/\s*\(.*$/, "");
      if (!titleText || !shown) continue;
      const authors = [...new Set([shown, ...linkTargets(authorText)])];

      const resultText = plain(at("result")?.text ?? "");
      const stage =
        stageFrom(resultText) ??
        stageFromColour(r.attrs) ??
        stageFromColour(cells.map((c) => c.attrs).join(";"));
      const note = [plain(at("category")?.text ?? ""), resultText]
        .filter(Boolean)
        .join(" · ");
      out.push({
        year: (at("year") ? yearIn(at("year")!.text) : null) ?? headingYear,
        authors,
        title: titleText,
        stage,
        note,
      });
    }
  }
  return out;
}
