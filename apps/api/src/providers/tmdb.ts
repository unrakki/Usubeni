import { env } from "../env.ts";
import { HttpError } from "../errors.ts";

const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_URL = "https://image.tmdb.org/t/p/w500";

// Only the fields we read from TMDB responses.
interface TmdbMovieSummary {
  id: number;
  title: string;
  poster_path: string | null;
  release_date?: string;
}

interface TmdbShowSummary {
  id: number;
  name: string;
  poster_path: string | null;
  first_air_date?: string;
}

interface TmdbSearchResponse<T> {
  page: number;
  total_pages: number;
  results: T[];
}

interface TmdbMovie extends TmdbMovieSummary {
  overview: string;
  runtime: number | null;
  genres: { name: string }[];
  vote_average: number;
  status: string;
}

interface TmdbEpisodeRef {
  season_number: number;
  episode_number: number;
  air_date: string | null;
}

interface TmdbShow extends TmdbShowSummary {
  overview: string;
  genres: { name: string }[];
  vote_average: number;
  status: string;
  seasons: {
    season_number: number;
    name: string;
    episode_count: number;
    air_date: string | null;
    poster_path: string | null;
  }[];
  last_episode_to_air: TmdbEpisodeRef | null;
}

interface TmdbSeason {
  season_number: number;
  name: string;
  poster_path: string | null;
  episodes: {
    episode_number: number;
    name: string;
    overview: string;
    air_date: string | null;
    still_path: string | null;
    runtime: number | null;
  }[];
}

export type SearchType = "movie" | "tv";

export interface SearchResult {
  mediaId: string;
  source: "tmdb";
  mediaType: SearchType;
  title: string;
  image: string;
  year: number | null;
}

export interface MovieMetadata extends SearchResult {
  mediaType: "movie";
  synopsis: string;
  releaseDate: string | null;
  runtime: number | null;
  genres: string[];
  score: number | null;
  status: string;
  maxProgress: number;
}

export interface SeasonSummary {
  seasonNumber: number;
  title: string;
  image: string;
  episodeCount: number;
  // Derived from the show's last aired episode, so no per-season request.
  airedEpisodeCount: number;
  airDate: string | null;
}

export interface ShowMetadata extends SearchResult {
  mediaType: "tv";
  synopsis: string;
  genres: string[];
  score: number | null;
  status: string;
  // No more episodes are expected.
  ended: boolean;
  seasons: SeasonSummary[];
}

export interface EpisodeMetadata {
  episodeNumber: number;
  title: string;
  synopsis: string;
  airDate: string | null;
  image: string;
  runtime: number | null;
  aired: boolean;
}

export interface SeasonMetadata {
  mediaId: string;
  seasonNumber: number;
  title: string;
  image: string;
  episodes: EpisodeMetadata[];
}

async function request<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  if (!env.TMDB_API) {
    throw new HttpError(503, "TMDB_API is not configured");
  }
  const url = new URL(`${BASE_URL}${path}`);
  url.search = new URLSearchParams({
    api_key: env.TMDB_API,
    language: env.TMDB_LANG,
    ...params,
  }).toString();

  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    // Network failure: TMDB unreachable, DNS, TLS, reset connection.
    throw new HttpError(
      502,
      `TMDB request failed: ${error instanceof Error ? error.message : String(error)}`,
      error,
    );
  }
  if (response.status === 404) {
    throw new HttpError(404, "Not found on TMDB");
  }
  if (!response.ok) {
    throw new HttpError(502, `TMDB responded with ${response.status}`);
  }
  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new HttpError(502, "TMDB returned a malformed response", error);
  }
}

// No poster is null on TMDB; item.image is required, so use an empty string.
const imageUrl = (path: string | null) => (path ? `${IMAGE_URL}${path}` : "");

const year = (date: string | undefined) =>
  date ? Number(date.slice(0, 4)) : null;

// TMDB air dates are calendar days; compare them as YYYY-MM-DD strings.
const hasAired = (airDate: string | null, now: Date) =>
  airDate !== null && airDate <= now.toISOString().slice(0, 10);

function movieResult(movie: TmdbMovieSummary): SearchResult {
  return {
    mediaId: String(movie.id),
    source: "tmdb",
    mediaType: "movie",
    title: movie.title,
    image: imageUrl(movie.poster_path),
    year: year(movie.release_date),
  };
}

function showResult(show: TmdbShowSummary): SearchResult {
  return {
    mediaId: String(show.id),
    source: "tmdb",
    mediaType: "tv",
    title: show.name,
    image: imageUrl(show.poster_path),
    year: year(show.first_air_date),
  };
}

export async function search(type: SearchType, query: string, page: number) {
  const params = { query, page: String(page) };
  if (type === "movie") {
    const data = await request<TmdbSearchResponse<TmdbMovieSummary>>(
      "/search/movie",
      params,
    );
    return {
      page: data.page,
      totalPages: data.total_pages,
      results: data.results.map(movieResult),
    };
  }
  const data = await request<TmdbSearchResponse<TmdbShowSummary>>(
    "/search/tv",
    params,
  );
  return {
    page: data.page,
    totalPages: data.total_pages,
    results: data.results.map(showResult),
  };
}

export async function getMovie(id: string): Promise<MovieMetadata> {
  const movie = await request<TmdbMovie>(`/movie/${encodeURIComponent(id)}`);
  return {
    ...movieResult(movie),
    mediaType: "movie",
    synopsis: movie.overview,
    releaseDate: movie.release_date || null,
    runtime: movie.runtime || null,
    genres: movie.genres.map((genre) => genre.name),
    // TMDB reports 0 when nobody has voted yet.
    score: movie.vote_average || null,
    status: movie.status,
    maxProgress: 1,
  };
}

export async function getShow(
  id: string,
  now = new Date(),
): Promise<ShowMetadata> {
  const show = await request<TmdbShow>(`/tv/${encodeURIComponent(id)}`);
  const last = show.last_episode_to_air;

  const aired = (season: TmdbShow["seasons"][number]) => {
    // Specials are scattered in time; count them all once the season started.
    if (season.season_number === 0) {
      return hasAired(season.air_date, now) ? season.episode_count : 0;
    }
    if (!last || season.season_number > last.season_number) return 0;
    if (season.season_number < last.season_number) return season.episode_count;
    return last.episode_number;
  };

  return {
    ...showResult(show),
    mediaType: "tv",
    synopsis: show.overview,
    genres: show.genres.map((genre) => genre.name),
    score: show.vote_average || null,
    status: show.status,
    ended: show.status === "Ended" || show.status === "Canceled",
    seasons: show.seasons.map((season) => ({
      seasonNumber: season.season_number,
      title: season.name,
      image: imageUrl(season.poster_path),
      episodeCount: season.episode_count,
      airedEpisodeCount: aired(season),
      airDate: season.air_date,
    })),
  };
}

export async function getSeason(
  id: string,
  seasonNumber: number,
  now = new Date(),
): Promise<SeasonMetadata> {
  const season = await request<TmdbSeason>(
    `/tv/${encodeURIComponent(id)}/season/${seasonNumber}`,
  );
  return {
    mediaId: id,
    seasonNumber: season.season_number,
    title: season.name,
    image: imageUrl(season.poster_path),
    episodes: season.episodes.map((episode) => ({
      episodeNumber: episode.episode_number,
      title: episode.name,
      synopsis: episode.overview,
      airDate: episode.air_date,
      image: imageUrl(episode.still_path),
      runtime: episode.runtime,
      aired: hasAired(episode.air_date, now),
    })),
  };
}
