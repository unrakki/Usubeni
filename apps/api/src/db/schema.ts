import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// Values mirror Yamtrack so its CSV exports import as-is.
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

// Drizzle's text enums only type the column; this makes SQLite reject other values
// too. Values are the constants above, so inlining them is safe.
const isOneOf = (column: AnySQLiteColumn, values: readonly string[]) =>
  sql`${column} IN (${sql.raw(values.map((v) => `'${v}'`).join(", "))})`;

export const item = sqliteTable(
  "item",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    mediaId: text("media_id").notNull(),
    source: text({ enum: SOURCES }).notNull(),
    mediaType: text("media_type", { enum: MEDIA_TYPES }).notNull(),
    title: text().notNull(),
    image: text().notNull(),
    seasonNumber: integer("season_number"),
    episodeNumber: integer("episode_number"),
  },
  (t) => [
    uniqueIndex("item_unique_without_season_episode")
      .on(t.mediaId, t.source, t.mediaType)
      .where(sql`${t.seasonNumber} IS NULL AND ${t.episodeNumber} IS NULL`),
    uniqueIndex("item_unique_with_season")
      .on(t.mediaId, t.source, t.mediaType, t.seasonNumber)
      .where(sql`${t.seasonNumber} IS NOT NULL AND ${t.episodeNumber} IS NULL`),
    uniqueIndex("item_unique_with_season_episode")
      .on(t.mediaId, t.source, t.mediaType, t.seasonNumber, t.episodeNumber)
      .where(
        sql`${t.seasonNumber} IS NOT NULL AND ${t.episodeNumber} IS NOT NULL`,
      ),
    check("item_source_valid", isOneOf(t.source, SOURCES)),
    check("item_media_type_valid", isOneOf(t.mediaType, MEDIA_TYPES)),
    // Season 0 is TMDB's specials season. IS NOT NULL is needed because a CHECK
    // that evaluates to NULL passes.
    check(
      "item_season_numbering",
      sql`${t.mediaType} <> 'season' OR (${t.seasonNumber} IS NOT NULL AND ${t.seasonNumber} >= 0 AND ${t.episodeNumber} IS NULL)`,
    ),
    check(
      "item_episode_numbering",
      sql`${t.mediaType} <> 'episode' OR (${t.seasonNumber} IS NOT NULL AND ${t.seasonNumber} >= 0 AND ${t.episodeNumber} IS NOT NULL AND ${t.episodeNumber} >= 1)`,
    ),
    check(
      "item_numbering_only_for_tv_parts",
      sql`${t.mediaType} IN ('season', 'episode') OR (${t.seasonNumber} IS NULL AND ${t.episodeNumber} IS NULL)`,
    ),
  ],
);

// Attaches MAL/AniList entries to a TMDB item so an anime is tracked once, with
// TMDB seasons, instead of duplicated as separate anime entries. An entry can
// cover part of a season (split cours), hence the episode range.
export const itemLink = sqliteTable(
  "item_link",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    itemId: integer("item_id")
      .notNull()
      .references(() => item.id, { onDelete: "cascade" }),
    source: text({ enum: LINK_SOURCES }).notNull(),
    mediaId: text("media_id").notNull(),
    // Null links the whole item (a movie); 0 is TMDB's specials season.
    seasonNumber: integer("season_number"),
    // Null range covers the whole season.
    episodeStart: integer("episode_start"),
    episodeEnd: integer("episode_end"),
  },
  (t) => [
    // Split by nullability because SQLite treats NULLs as distinct in unique indexes.
    uniqueIndex("item_link_unique_whole_item")
      .on(t.source, t.mediaId, t.itemId)
      .where(sql`${t.seasonNumber} IS NULL`),
    uniqueIndex("item_link_unique_whole_season")
      .on(t.source, t.mediaId, t.itemId, t.seasonNumber)
      .where(sql`${t.seasonNumber} IS NOT NULL AND ${t.episodeStart} IS NULL`),
    uniqueIndex("item_link_unique_range")
      .on(t.source, t.mediaId, t.itemId, t.seasonNumber, t.episodeStart)
      .where(sql`${t.episodeStart} IS NOT NULL`),
    index("item_link_item_id_idx").on(t.itemId),
    check("item_link_source_valid", isOneOf(t.source, LINK_SOURCES)),
    check(
      "item_link_season_non_negative",
      sql`${t.seasonNumber} IS NULL OR ${t.seasonNumber} >= 0`,
    ),
    check(
      "item_link_range_complete",
      sql`(${t.episodeStart} IS NULL) = (${t.episodeEnd} IS NULL)`,
    ),
    check(
      "item_link_range_needs_season",
      sql`${t.episodeStart} IS NULL OR ${t.seasonNumber} IS NOT NULL`,
    ),
    check(
      "item_link_range_order",
      sql`${t.episodeStart} IS NULL OR (${t.episodeStart} >= 1 AND ${t.episodeEnd} >= ${t.episodeStart})`,
    ),
  ],
);

export const media = sqliteTable(
  "media",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    itemId: integer("item_id")
      .notNull()
      .references(() => item.id, { onDelete: "cascade" }),
    // A season's parent is its show's entry.
    parentId: integer("parent_id").references((): AnySQLiteColumn => media.id, {
      onDelete: "cascade",
    }),
    score: real(),
    // Minutes of playtime for games, units consumed otherwise.
    progress: integer().notNull().default(0),
    status: text({ enum: STATUSES }).notNull().default("Completed"),
    startDate: integer("start_date", { mode: "timestamp" }),
    endDate: integer("end_date", { mode: "timestamp" }),
    notes: text().notNull().default(""),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("media_item_id_idx").on(t.itemId),
    index("media_parent_id_idx").on(t.parentId),
    check(
      "media_score_range",
      sql`${t.score} IS NULL OR ${t.score} BETWEEN 0 AND 10`,
    ),
    check("media_status_valid", isOneOf(t.status, STATUSES)),
    check("media_progress_non_negative", sql`${t.progress} >= 0`),
  ],
);

// One row per viewing, so rewatches are kept.
export const episode = sqliteTable(
  "episode",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    itemId: integer("item_id")
      .notNull()
      .references(() => item.id, { onDelete: "cascade" }),
    seasonId: integer("season_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    endDate: integer("end_date", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("episode_item_id_idx").on(t.itemId),
    index("episode_season_id_idx").on(t.seasonId),
  ],
);
