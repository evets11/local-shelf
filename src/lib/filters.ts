// Search/browse filter shapes shared by Explorer and the live catalogue results. Client-safe.

export const DECADES: Record<string, [number, number]> = {
  "2020s": [2020, 2029],
  "2010s": [2010, 2019],
  "2000s": [2000, 2009],
  "1990s": [1990, 1999],
  "1980s": [1980, 1989],
  classic: [0, 1979],
};

export const DECADE_LABELS: Record<string, string> = { classic: "Before 1980" };

export interface Filters {
  available: boolean;
  branch: string;
  genre: string;
  cert: string;
  decade: string;
  language: string;
  audience: string;
  format: string;
}

export function inDecade(year: number | null, decade: string): boolean {
  const range = DECADES[decade];
  return Boolean(range && year && year >= range[0] && year <= range[1]);
}

/** The filters that live catalogue hits can also be checked against. */
export function matchesFormatAndDecade(
  t: { format: string; year: number | null },
  f: Pick<Filters, "format" | "decade">,
): boolean {
  return (
    (!f.format || t.format === f.format) &&
    (!f.decade || inDecade(t.year, f.decade))
  );
}
