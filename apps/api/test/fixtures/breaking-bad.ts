// Breaking Bad (TMDB 1396) as TMDB describes it on the current (mocked) date.
// Season and episode counts match the show; air dates are weekly
// approximations from each part's premiere, and the specials are made up.

const SHOW_ID = 1396;

const PARTS: { season: number; premiere: string; episodes: number }[] = [
  { season: 0, premiere: "2009-02-17", episodes: 3 },
  { season: 1, premiere: "2008-01-20", episodes: 7 },
  { season: 2, premiere: "2009-03-08", episodes: 13 },
  { season: 3, premiere: "2010-03-21", episodes: 13 },
  { season: 4, premiere: "2011-07-17", episodes: 13 },
  // Season 5 aired in two halves, a year apart.
  { season: 5, premiere: "2012-07-15", episodes: 8 },
  { season: 5, premiere: "2013-08-11", episodes: 8 },
];

const addWeeks = (date: string, weeks: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
};

const EPISODES = PARTS.flatMap((part) => part).reduce<
  { season: number; episode: number; airDate: string }[]
>((all, part) => {
  const offset = all.filter((e) => e.season === part.season).length;
  for (let i = 0; i < part.episodes; i++) {
    all.push({
      season: part.season,
      episode: offset + i + 1,
      airDate: addWeeks(part.premiere, i),
    });
  }
  return all;
}, []);

export const FINALE = addWeeks("2013-08-11", 7);

const seasonNumbers = [...new Set(EPISODES.map((e) => e.season))];
const episodesOf = (season: number) =>
  EPISODES.filter((e) => e.season === season);
const today = () => new Date().toISOString().slice(0, 10);

export function showResponse() {
  const aired = EPISODES.filter((e) => e.season > 0 && e.airDate <= today());
  const last = aired.at(-1);
  return Response.json({
    id: SHOW_ID,
    name: "Breaking Bad",
    poster_path: "/breaking-bad.jpg",
    first_air_date: "2008-01-20",
    overview: "A chemistry teacher turns to making meth.",
    genres: [{ name: "Drama" }, { name: "Crime" }],
    vote_average: 8.9,
    status: today() > FINALE ? "Ended" : "Returning Series",
    seasons: seasonNumbers.map((season) => ({
      season_number: season,
      name: season === 0 ? "Specials" : `Season ${season}`,
      episode_count: episodesOf(season).length,
      air_date: episodesOf(season)[0]!.airDate,
      poster_path: `/breaking-bad-s${season}.jpg`,
    })),
    last_episode_to_air: last
      ? {
          season_number: last.season,
          episode_number: last.episode,
          air_date: last.airDate,
        }
      : null,
  });
}

export function seasonResponse(season: number) {
  return Response.json({
    season_number: season,
    name: season === 0 ? "Specials" : `Season ${season}`,
    poster_path: `/breaking-bad-s${season}.jpg`,
    episodes: episodesOf(season).map((e) => ({
      episode_number: e.episode,
      name: `S${season}E${e.episode}`,
      overview: "",
      air_date: e.airDate,
      still_path: null,
      runtime: 47,
    })),
  });
}

export const tmdbPaths = {
  [`/3/tv/${SHOW_ID}`]: showResponse,
  "/3/search/tv": () =>
    Response.json({
      page: 1,
      total_pages: 1,
      results: [
        {
          id: SHOW_ID,
          name: "Breaking Bad",
          poster_path: "/breaking-bad.jpg",
          first_air_date: "2008-01-20",
        },
      ],
    }),
  ...Object.fromEntries(
    seasonNumbers.map((season) => [
      `/3/tv/${SHOW_ID}/season/${season}`,
      () => seasonResponse(season),
    ]),
  ),
};
