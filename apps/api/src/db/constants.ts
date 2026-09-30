// Kept free of imports so the web app can use them at runtime.

// Values match the Yamtrack CSV export, so it imports as-is.
export const SOURCES = [
  "tmdb",
  "mal",
  "mangaupdates",
  "igdb",
  "openlibrary",
  "hardcover",
  "comicvine",
  "manual",
] as const;

export const MEDIA_TYPES = [
  "tv",
  "season",
  "episode",
  "movie",
  "anime",
  "manga",
  "game",
  "book",
  "comic",
] as const;

export const STATUSES = [
  "Completed",
  "In progress",
  // All released parts are consumed and more are announced (TV, ongoing series).
  "Caught up",
  "Planning",
  "Paused",
  "Dropped",
] as const;

export const LINK_SOURCES = ["mal", "anilist"] as const;

type MediaType = (typeof MEDIA_TYPES)[number];
type Status = (typeof STATUSES)[number];

// Statuses a media type can take. "Caught up" means more is announced, which
// never applies to a movie.
export function statusesFor(mediaType: MediaType): readonly Status[] {
  return mediaType === "movie"
    ? STATUSES.filter((status) => status !== "Caught up")
    : STATUSES;
}
