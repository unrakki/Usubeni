import { env } from "../env.ts";
import { ProviderError } from "./errors.ts";

const BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_URL = "https://image.tmdb.org/t/p/w500";

// Only the fields we read from TMDB responses.
interface TmdbMovieSummary {
  id: number;
  title: string;
  poster_path: string | null;
  release_date?: string;
}

interface TmdbSearchResponse {
  page: number;
  total_pages: number;
  results: TmdbMovieSummary[];
}

interface TmdbMovie extends TmdbMovieSummary {
  overview: string;
  runtime: number | null;
  genres: { name: string }[];
  vote_average: number;
  status: string;
}

export interface SearchResult {
  mediaId: string;
  source: "tmdb";
  mediaType: "movie";
  title: string;
  image: string;
  year: number | null;
}

export interface MovieMetadata extends SearchResult {
  synopsis: string;
  releaseDate: string | null;
  runtime: number | null;
  genres: string[];
  score: number | null;
  status: string;
  maxProgress: number;
}

async function request<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  if (!env.TMDB_API) {
    throw new ProviderError("TMDB_API is not configured", 503);
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
    throw new ProviderError(
      `TMDB request failed: ${error instanceof Error ? error.message : String(error)}`,
      502,
      error,
    );
  }
  if (response.status === 404) {
    throw new ProviderError("Not found on TMDB", 404);
  }
  if (!response.ok) {
    throw new ProviderError(`TMDB responded with ${response.status}`, 502);
  }
  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new ProviderError("TMDB returned a malformed response", 502, error);
  }
}

// No poster is null on TMDB; item.image is required, so use an empty string.
const imageUrl = (path: string | null) => (path ? `${IMAGE_URL}${path}` : "");

const year = (date: string | undefined) =>
  date ? Number(date.slice(0, 4)) : null;

function toSearchResult(movie: TmdbMovieSummary): SearchResult {
  return {
    mediaId: String(movie.id),
    source: "tmdb",
    mediaType: "movie",
    title: movie.title,
    image: imageUrl(movie.poster_path),
    year: year(movie.release_date),
  };
}

export async function searchMovies(query: string, page: number) {
  const data = await request<TmdbSearchResponse>("/search/movie", {
    query,
    page: String(page),
  });
  return {
    page: data.page,
    totalPages: data.total_pages,
    results: data.results.map(toSearchResult),
  };
}

export async function getMovie(id: string): Promise<MovieMetadata> {
  const movie = await request<TmdbMovie>(`/movie/${encodeURIComponent(id)}`);
  return {
    ...toSearchResult(movie),
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
