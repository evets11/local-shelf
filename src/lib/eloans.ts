// Live e-loan status from BorrowBox and Libby (OverDrive). Server-only.
// BorrowBox: one robots-allowed /product/<id> page per lookup (no query strings, no /_next/).
// Libby: OverDrive's public "thunder" API, which the Libby web app uses. Undocumented, so
// callers treat any throw as "no status" and the UI keeps plain links.
import { USER_AGENT, WindowLimit } from "./spydus/client";
import { BORROWBOX_BASE, LIBBY_LIBRARY, isBorrowBoxId } from "./spydus/urls";
import type { BorrowBoxStatus, LibbyMatch } from "./types";

const THUNDER = `https://thunder.api.overdrive.com/v2/libraries/${LIBBY_LIBRARY}/media`;
const TIMEOUT_MS = 6_000;

// Per-instance caps across all visitors; results are cached (use cache + CDN) on top.
// BorrowBox robots.txt: Request-rate 1/10s.
const borrowBoxLimit = new WindowLimit(6, 60_000);
const libbyLimit = new WindowLimit(30, 60_000);

async function get(url: string, accept: string): Promise<Response> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: accept },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

/** Status from a BorrowBox product page's __NEXT_DATA__. Null if it isn't that product. Exported for tests. */
export function parseBorrowBox(
  html: string,
  id: string,
): BorrowBoxStatus | null {
  const m =
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(
      html,
    );
  if (!m) return null;
  const product = JSON.parse(m[1])?.props?.pageProps?.product;
  if (!product || product.productId !== id) return null;
  const status = String(product.availability?.availabilityStatus ?? "");
  const next = Number(product.availability?.nextAvailableDate);
  return {
    id,
    available:
      status === "AVAILABLE" ? true : status === "ON_LOAN" ? false : null,
    nextAvailable:
      status === "ON_LOAN" && next > 0
        ? new Date(next).toISOString().slice(0, 10)
        : null,
  };
}

export async function borrowBoxStatus(id: string): Promise<BorrowBoxStatus | null> {
  if (!isBorrowBoxId(id)) return null;
  borrowBoxLimit.take("BorrowBox checks");
  const res = await get(`${BORROWBOX_BASE}/product/${id}`, "text/html");
  return parseBorrowBox(await res.text(), id);
}

interface ThunderItem {
  id: string;
  title?: string;
  type?: { id?: string };
  firstCreatorName?: string;
  creators?: { name?: string; role?: string }[];
  formats?: { identifiers?: { type?: string; value?: string }[] }[];
  isAvailable?: boolean;
  isOwned?: boolean;
  holdsCount?: number;
  estimatedWaitDays?: number;
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
/** "Wild Dark Shore: A Novel" and "The Wild Dark Shore" both fold to "wild dark shore". */
const foldTitle = (s: string) =>
  fold(s.split(/\s*[:(]/)[0]).replace(/^(the|a|an) /, "");
/** Surnames are enough, and cope with "McConaghy, Charlotte" vs "Charlotte McConaghy". */
const surname = (s: string) => {
  const name = s.includes(",")
    ? s.split(",")[0]
    : (s.split(/\s+/).at(-1) ?? "");
  return fold(name);
};

export interface LibbyQuery {
  type: "ebook" | "audiobook";
  isbn: string | null;
  title: string;
  author: string | null;
}

/** The Libby title for this book, only on an exact ISBN or a strict title + author + type match. Exported for tests. */
export function pickLibbyMatch(
  items: ThunderItem[],
  q: LibbyQuery,
): ThunderItem | null {
  const owned = items.filter(
    (m) => m.isOwned !== false && m.type?.id === q.type,
  );
  if (q.isbn) {
    const byIsbn = owned.find((m) =>
      m.formats?.some((f) =>
        f.identifiers?.some((i) => i.value?.replace(/-/g, "") === q.isbn),
      ),
    );
    if (byIsbn) return byIsbn;
  }
  if (!q.author) return null;
  const want = foldTitle(q.title);
  const by = surname(q.author);
  return (
    owned.find(
      (m) =>
        foldTitle(m.title ?? "") === want &&
        [m.firstCreatorName, ...(m.creators ?? []).map((c) => c.name)].some(
          (n) => n && surname(n) === by,
        ),
    ) ?? null
  );
}

async function thunderSearch(query: string): Promise<ThunderItem[]> {
  libbyLimit.take("Libby checks");
  const res = await get(
    `${THUNDER}?query=${encodeURIComponent(query)}&perPage=10`,
    "application/json",
  );
  const json = (await res.json()) as { items?: ThunderItem[] };
  return json.items ?? [];
}

export async function libbyMatch(q: LibbyQuery): Promise<LibbyMatch | null> {
  let hit = q.isbn
    ? pickLibbyMatch(await thunderSearch(q.isbn), { ...q, author: null })
    : null;
  if (!hit && q.author)
    hit = pickLibbyMatch(await thunderSearch(`${q.title} ${q.author}`), q);
  if (!hit) return null;
  return {
    id: hit.id,
    available: hit.isAvailable ?? null,
    holds: hit.isAvailable ? null : (hit.holdsCount ?? null),
    waitDays: hit.isAvailable ? null : (hit.estimatedWaitDays ?? null),
  };
}
