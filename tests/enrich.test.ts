import { describe, expect, it } from "vitest";
import {
  buildExtras,
  chooseMatch,
  classify,
  evaluateCandidate,
  isTrailer,
  normaliseTitle,
  parseCatalogueTitle,
  parseOutOf100,
  parsePercent,
  peopleOverlap,
  pickId,
  pickMetacriticScore,
  pickRottenTomatoesScore,
  pickTrailer,
  Q,
  samePerson,
  titleVariants,
  type CatalogueFilm,
  type EntityKind,
  type WdCandidate,
  type WdVideo,
} from "../src/lib/enrich/match";

const film = (o: Partial<CatalogueFilm>): CatalogueFilm => ({
  irn: "1",
  title: "Solaris",
  year: 1972,
  releaseYear: 2016,
  directors: [],
  cast: [],
  genres: [],
  ...o,
});

const cand = (o: Partial<WdCandidate>): WdCandidate => ({
  id: "Q1",
  label: "Solaris",
  aliases: [],
  enwiki: null,
  p31: ["Q11424"],
  dates: [],
  directors: [],
  cast: [],
  imdb: [],
  rottenTomatoes: [],
  scores: [],
  videos: [],
  ...o,
});

function decide(f: CatalogueFilm, cands: [WdCandidate, EntityKind][]) {
  const parsed = parseCatalogueTitle(f.title);
  const evals = cands.flatMap(([c, kind]) =>
    titleVariants(parsed).map((v) =>
      evaluateCandidate({ film: f, parsed, kind }, v, c),
    ),
  );
  return chooseMatch(evals);
}

describe("normaliseTitle", () => {
  it("folds case, punctuation, diacritics, articles and ampersands", () => {
    expect(normaliseTitle("The 400 Blows")).toBe("400 blows");
    expect(normaliseTitle("Amélie")).toBe("amelie");
    expect(normaliseTitle("Star Wars: Episode II – Attack of the Clones")).toBe(
      normaliseTitle("Star wars: Episode II - Attack of the clones"),
    );
    expect(normaliseTitle("Fast & Furious")).toBe(
      normaliseTitle("Fast and furious"),
    );
    expect(normaliseTitle("Kensuke's Kingdom")).toBe("kensukes kingdom");
    expect(normaliseTitle("A Complete Unknown")).toBe("complete unknown");
  });
});

describe("people", () => {
  it("matches names across diacritics and initials", () => {
    expect(samePerson("Francois Truffaut", "François Truffaut")).toBe(true);
    expect(samePerson("D.W. Griffith", "D. W. Griffith")).toBe(true);
    expect(samePerson("Hamilton S. Luske", "Hamilton Luske")).toBe(true);
    expect(samePerson("Tony Scott", "Ridley Scott")).toBe(false);
    expect(samePerson("Chang-dong Lee", "Lee Chang-dong")).toBe(true);
    expect(samePerson("Pedro AlmodÔovar", "Pedro Almodóvar")).toBe(true);
    expect(samePerson("Pedro AlmodO\u0302ovar", "Pedro Almodóvar")).toBe(true);
    expect(samePerson("Þorsteinn Bachmann", "Thorsteinn Bachmann")).toBe(false);
    expect(samePerson("Zhangke Jia", "Jia Zhangke")).toBe(true);
    expect(samePerson("Jia Zhang-Ke", "Jia Zhangke")).toBe(true);
    expect(samePerson("John Stalberg.", "John Stalberg Jr.")).toBe(true);
    expect(
      peopleOverlap(["Eric Darnell", "Tom McGrath"], ["Tom McGrath"]),
    ).toBe(1);
  });
});

describe("parseCatalogueTitle", () => {
  it("strips year hints, brand parentheticals and edition suffixes", () => {
    expect(parseCatalogueTitle("Anaconda (2025)")).toMatchObject({
      base: "Anaconda",
      yearHint: 2025,
    });
    expect(parseCatalogueTitle("Beauty and the Beast (Disney)")).toMatchObject({
      base: "Beauty and the Beast",
      yearHint: null,
    });
    expect(parseCatalogueTitle("Crash: Director's cut").base).toBe("Crash");
    expect(parseCatalogueTitle("Fawlty Towers: Remastered").base).toBe(
      "Fawlty Towers",
    );
    expect(
      parseCatalogueTitle(
        "The birth of a nation - The Masters of Cinema Series",
      ).base,
    ).toBe("The birth of a nation");
  });

  it("detects season box sets", () => {
    expect(parseCatalogueTitle("Slow horses. Series 3").season).toEqual({
      seriesName: "Slow horses",
      number: 3,
    });
    expect(parseCatalogueTitle("The crown: Season four").season).toEqual({
      seriesName: "The crown",
      number: 4,
    });
    expect(
      parseCatalogueTitle("Game of thrones: The complete eighth season").season,
    ).toEqual({
      seriesName: "Game of thrones",
      number: 8,
    });
    expect(
      parseCatalogueTitle("Doctor Who Series 7:Part 2a").season?.seriesName,
    ).toBe("Doctor Who");
    expect(
      parseCatalogueTitle("A series of unfortunate events").season,
    ).toBeNull();
  });

  it("flags multi-film sets and compilations", () => {
    expect(
      parseCatalogueTitle(
        "Shrek collection [Digital Versatile Disc] : Shrek and Shrek 2",
      ).multi,
    ).toBe(true);
    expect(
      parseCatalogueTitle(
        "The Apu trilogy: Pather panchali/Aparajito/The world of Apu",
      ).multi,
    ).toBe(true);
    expect(
      parseCatalogueTitle("Hey Duggee: The fashion badge and 9 other stories")
        .multi,
    ).toBe(true);
    expect(
      parseCatalogueTitle("Be cool Scooby-Doo!: Season 1 - volume 1").multi,
    ).toBe(true);
    expect(titleVariants(parseCatalogueTitle("Shrek collection"))).toEqual([]);
  });

  it("offers both halves of colon titles as partial variants", () => {
    expect(
      titleVariants(parseCatalogueTitle("Charlie Chaplin: Limelight")),
    ).toEqual([
      { text: "Charlie Chaplin: Limelight", kind: "full" },
      { text: "Limelight", kind: "partial" },
      { text: "Charlie Chaplin", kind: "partial" },
    ]);
  });
});

describe("classify", () => {
  it("prefers film, rejects episodes", () => {
    const f = new Set(["Q11424", "Q29168811"]);
    const tv = new Set(["Q5398426"]);
    const ep = new Set(["Q21191270"]);
    expect(classify(["Q29168811"], f, tv, ep)).toBe("film");
    expect(classify(["Q5398426"], f, tv, ep)).toBe("tv");
    expect(classify(["Q21191270", "Q5398426"], f, tv, ep)).toBe("other");
    expect(classify(["Q5"], f, tv, ep)).toBe("other");
  });
});

describe("matching", () => {
  const tarkovsky = cand({
    id: "Q125772",
    dates: ["1972-03-20T00:00:00Z"],
    directors: ["Andrei Tarkovsky"],
  });
  const soderbergh = cand({
    id: "Q673195",
    dates: ["2002-11-27T00:00:00Z"],
    directors: ["Steven Soderbergh"],
  });

  it("separates same-title remakes by director", () => {
    const d = decide(film({ directors: ["Andrei Tarkovsky"] }), [
      [tarkovsky, "film"],
      [soderbergh, "film"],
    ]);
    expect(d.qid).toBe("Q125772");
  });

  it("separates remakes by year when directors are unknown", () => {
    const old = cand({
      id: "Q_1961",
      label: "101 Dalmatians",
      dates: ["1961-01-25"],
    });
    const remake = cand({
      id: "Q_1996",
      label: "101 Dalmatians",
      dates: ["1996-11-27"],
    });
    const f = film({ title: "101 dalmatians", year: 1996, releaseYear: 2001 });
    expect(
      decide(f, [
        [old, "film"],
        [remake, "film"],
      ]).qid,
    ).toBe("Q_1996");
  });

  it("rejects a director conflict even with the right year", () => {
    const d = decide(
      film({ year: 2002, releaseYear: 2003, directors: ["Someone Else"] }),
      [[soderbergh, "film"]],
    );
    expect(d.qid).toBeNull();
  });

  it("rejects ties", () => {
    const a = cand({ id: "Qa", label: "Emily", dates: ["2022-01-01"] });
    const b = cand({ id: "Qb", label: "Emily", dates: ["2022-06-01"] });
    const d = decide(film({ title: "Emily", year: 2022, releaseYear: 2022 }), [
      [a, "film"],
      [b, "film"],
    ]);
    expect(d.qid).toBeNull();
    expect(d.reason).toMatch(/ambiguous/);
  });

  it("needs the parenthetical year to agree", () => {
    const old = cand({ id: "Q1997", label: "Anaconda", dates: ["1997-04-11"] });
    const f = film({ title: "Anaconda (2025)", year: 2025, releaseYear: 2025 });
    expect(decide(f, [[old, "film"]]).qid).toBeNull();
  });

  it("requires people evidence for half-title matches", () => {
    const limelight = cand({
      id: "Q584509",
      label: "Limelight",
      dates: ["1952-10-23"],
      directors: ["Charlie Chaplin"],
    });
    const f = film({
      title: "Charlie Chaplin: Limelight",
      year: 1952,
      releaseYear: 2010,
      directors: ["Someone Else"],
    });
    // Half titles never match on title + year alone.
    expect(decide(f, [[limelight, "film"]]).qid).toBeNull();
    expect(
      decide({ ...f, directors: ["Charles Chaplin"] }, [[limelight, "film"]])
        .qid,
    ).toBe("Q584509");
  });

  it("matches season box sets to the series by start year window", () => {
    const series = cand({
      id: "Qs",
      label: "Horrible Histories",
      dates: ["2009-04-16"],
    });
    const cartoon = cand({
      id: "Qc",
      label: "Horrible Histories",
      dates: ["2001-01-01"],
    });
    const f = film({
      title: "Horrible histories: Series 1",
      year: 2009,
      releaseYear: 2010,
      genres: ["TV"],
    });
    const d = decide(f, [
      [series, "tv"],
      [cartoon, "tv"],
    ]);
    expect(d).toMatchObject({ qid: "Qs", via: "series" });
    // A film with the same name is not a series match.
    expect(
      decide(f, [
        [
          cand({
            id: "Qf",
            label: "Horrible Histories",
            dates: ["2009-01-01"],
          }),
          "film",
        ],
      ]).qid,
    ).toBeNull();
  });

  it("needs director evidence to cross film/TV kinds", () => {
    const show = cand({ id: "Qtv", label: "Bodyguard", dates: ["2018-08-26"] });
    expect(
      decide(film({ title: "Bodyguard", year: 2018, releaseYear: 2018 }), [
        [show, "tv"],
      ]).qid,
    ).toBeNull();
    expect(
      decide(
        film({
          title: "Bodyguard",
          year: 2018,
          releaseYear: 2018,
          genres: ["TV"],
        }),
        [[show, "tv"]],
      ).qid,
    ).toBe("Qtv");
  });

  it("rejects entities that premiered after the DVD", () => {
    const later = cand({
      id: "Qn",
      dates: ["2020-01-01"],
      directors: ["Andrei Tarkovsky"],
    });
    expect(
      decide(
        film({
          directors: ["Andrei Tarkovsky"],
          year: 1972,
          releaseYear: 2016,
        }),
        [[later, "film"]],
      ).qid,
    ).toBeNull();
  });
});

describe("extras", () => {
  it("parses review score formats", () => {
    expect(parsePercent("94%")).toBe(94);
    expect(parsePercent("8/10")).toBeNull();
    expect(parseOutOf100("87/100")).toBe(87);
    expect(parseOutOf100("8.1/10")).toBeNull();
  });

  it("picks the latest Tomatometer and Metascore, ignoring averages and deprecated ranks", () => {
    const s = (
      value: string,
      by: string,
      method: string | null,
      date: string | null,
      rank: "normal" | "deprecated" = "normal",
    ) => ({
      value,
      by,
      method,
      date,
      rank,
    });
    const scores = [
      s("8/10", Q.rottenTomatoes, "Q108403540", "2026-01-01"),
      s("90%", Q.rottenTomatoes, Q.tomatometer, "2020-01-01"),
      s("88%", Q.rottenTomatoes, Q.tomatometer, "2024-01-01"),
      s("99%", Q.rottenTomatoes, Q.tomatometer, "2025-01-01", "deprecated"),
      s("70%", Q.rottenTomatoes, "Q_audience", "2026-01-01"),
      s("75/100", Q.metacritic, Q.metascore, "2026-01-16"),
    ];
    expect(pickRottenTomatoesScore(scores)).toBe(88);
    expect(pickMetacriticScore(scores)).toBe(75);
  });

  it("only treats short or trailer-tagged videos as trailers", () => {
    const v = (o: Partial<WdVideo>): WdVideo => ({
      value: "abcdefghijk",
      rank: "normal",
      role: null,
      lang: null,
      date: null,
      seconds: null,
      title: null,
      ...o,
    });
    expect(isTrailer(v({ role: Q.trailer }))).toBe(true);
    expect(isTrailer(v({ role: "Q_full" }))).toBe(false);
    expect(isTrailer(v({ seconds: 11690, title: "Titanic" }))).toBe(false);
    expect(isTrailer(v({ seconds: 150 }))).toBe(true);
    expect(isTrailer(v({ title: "Official Trailer" }))).toBe(true);
    expect(isTrailer(v({}))).toBe(false);
    expect(
      pickTrailer([
        v({ value: "xxxxxxxxxx1", seconds: 120, lang: "Q7737" }),
        v({ value: "xxxxxxxxxx2", seconds: 140, lang: Q.english }),
      ]),
    ).toBe("xxxxxxxxxx2");
  });

  it("only returns unambiguous ids", () => {
    expect(
      pickId([
        { value: "tt1", rank: "normal" },
        { value: "tt2", rank: "normal" },
      ]),
    ).toBeNull();
    expect(
      pickId([
        { value: "tt1", rank: "preferred" },
        { value: "tt2", rank: "normal" },
      ]),
    ).toBe("tt1");
    expect(
      pickId([
        { value: "tt1", rank: "deprecated" },
        { value: "tt2", rank: "normal" },
      ]),
    ).toBe("tt2");
  });

  it("drops scores for season box sets and builds wiki urls", () => {
    const c = cand({
      id: "Q9",
      enwiki: "Beauty and the Beast (1991 film)",
      imdb: [{ value: "tt0101414", rank: "normal" }],
      rottenTomatoes: [
        { value: "m/beauty_and_the_beast_1991", rank: "normal" },
      ],
      scores: [
        {
          value: "95%",
          rank: "normal",
          by: Q.rottenTomatoes,
          method: Q.tomatometer,
          date: null,
        },
      ],
    });
    expect(buildExtras(c, "full")).toEqual({
      wikidataId: "Q9",
      imdbId: "tt0101414",
      imdbRating: null,
      rottenTomatoesId: "m/beauty_and_the_beast_1991",
      rottenTomatoesScore: 95,
      metacriticScore: null,
      youtubeTrailerId: null,
      wikipediaUrl:
        "https://en.wikipedia.org/wiki/Beauty_and_the_Beast_(1991_film)",
    });
    expect(buildExtras(c, "series").rottenTomatoesScore).toBeNull();
  });
});
