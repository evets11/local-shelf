// Spydus URL builders. Dependency-free so client components can import it.

export const SPYDUS_BASE = "https://brighton-hove.spydus.co.uk";
export const CGI = "/cgi-bin/spydus.exe";

// robots.txt does prefix matching, so these are built as literal strings (no URLSearchParams reordering).
export const urls = {
  /** A catalogue search (disallowed ENQ prefix: one per list per sync), newest first, 100 per page. */
  listQuery: (qry: string) =>
    `${CGI}/ENQ/OPAC/BIBENQ?ENTRY=&ENTRY_NAME=BS&ENTRY_TYPE=K&QRY=${encodeURIComponent(qry)}&SORTS=SQL_PUBDATEDESC&NRECS=100`,
  /** A user's keyword search (live, relevance-ranked), narrowed by a QRY filter. */
  keywordSearch: (entry: string, qry: string) =>
    `${CGI}/ENQ/OPAC/BIBENQ?ENTRY=${encodeURIComponent(entry)}&ENTRY_NAME=BS&ENTRY_TYPE=K&QRY=${encodeURIComponent(qry)}&SORTS=SQL_REL_BIB&NRECS=40`,
  /** The DVD list query. */
  dvdQuery: () => urls.listQuery("BTYP: G"),
  page: (setId: string, page: number) =>
    `${CGI}/PAGE/OPAC/BIBENQ/${setId}/${page}`,
  full: (setId: string, irn: string, pos: number) =>
    `${CGI}/FULL/OPAC/BIBENQ/${setId}/${irn},${pos}`,
  holdings: (setId: string, irn: string) =>
    `${CGI}/XHLD/OPAC/BIBENQ/${setId}/${irn}?RECDISP=REC`,
  brn: (brn: string) =>
    `${CGI}/ENQ/OPAC/BIBENQ?SETLVL=&BRN=${encodeURIComponent(brn)}`,
  /** Public deep link for a title (robots-allowed). */
  publicRecord: (brn: string) =>
    `${SPYDUS_BASE}${CGI}/ENQ/OPAC/BIBENQ?SETLVL=&BRN=${encodeURIComponent(brn)}`,
};

/** Official library pages we link to (catalogue, joining, council info). */
export const LIBRARY_LINKS = {
  catalogue: `${SPYDUS_BASE}${CGI}/MSGTRN/OPAC/HOME`,
  join: `${SPYDUS_BASE}${CGI}/MSGTRN/OPAC/JOIN`,
  home: "https://www.brighton-hove.gov.uk/libraries-leisure-and-arts/libraries",
} as const;
