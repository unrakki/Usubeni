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
  "Planning",
  "Paused",
  "Dropped",
] as const;

export const LINK_SOURCES = ["mal", "anilist"] as const;
