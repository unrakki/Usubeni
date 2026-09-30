import {
  and,
  countDistinct,
  eq,
  getTableColumns,
  inArray,
  isNull,
  max,
  min,
  sql,
} from "drizzle-orm";
import {
  type MEDIA_TYPES,
  type SOURCES,
  type STATUSES,
  statusesFor,
} from "../db/constants.ts";
import { db } from "../db/index.ts";
import { episode, item, media } from "../db/schema.ts";
import { HttpError } from "../errors.ts";
import { applyTrackingRules } from "./tracking.ts";

export type MediaType = (typeof MEDIA_TYPES)[number];
type Source = (typeof SOURCES)[number];
export type Status = (typeof STATUSES)[number];

export interface ItemIdentity {
  source: Source;
  mediaType: MediaType;
  mediaId: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

export type TrackingFields = Partial<
  Pick<
    typeof media.$inferInsert,
    "status" | "score" | "progress" | "startDate" | "endDate" | "notes"
  >
>;

// A movie is watched once; other types come with their providers.
const maxProgressFor = (mediaType: MediaType) =>
  mediaType === "movie" ? 1 : null;

const entryWithItem = {
  ...getTableColumns(media),
  item: {
    id: item.id,
    mediaId: item.mediaId,
    source: item.source,
    mediaType: item.mediaType,
    title: item.title,
    image: item.image,
    seasonNumber: item.seasonNumber,
  },
};

export type Entry = NonNullable<ReturnType<typeof getEntry>>;

const sameItem = (identity: ItemIdentity) =>
  and(
    eq(item.source, identity.source),
    eq(item.mediaType, identity.mediaType),
    eq(item.mediaId, identity.mediaId),
    identity.seasonNumber === undefined
      ? isNull(item.seasonNumber)
      : eq(item.seasonNumber, identity.seasonNumber),
    identity.episodeNumber === undefined
      ? isNull(item.episodeNumber)
      : eq(item.episodeNumber, identity.episodeNumber),
  );

// Keeps the stored title and poster in sync with the provider on each write.
export function upsertItem(
  identity: ItemIdentity,
  title: string,
  image: string,
) {
  const existing = db.select().from(item).where(sameItem(identity)).get();
  if (existing) {
    return db
      .update(item)
      .set({ title, image })
      .where(eq(item.id, existing.id))
      .returning()
      .get();
  }
  return db
    .insert(item)
    .values({ ...identity, title, image })
    .returning()
    .get();
}

export function getEntry(id: number) {
  return db
    .select(entryWithItem)
    .from(media)
    .innerJoin(item, eq(media.itemId, item.id))
    .where(eq(media.id, id))
    .get();
}

function assertStatusFits(mediaType: MediaType, status: Status | undefined) {
  if (status !== undefined && !statusesFor(mediaType).includes(status)) {
    throw new HttpError(422, `A ${mediaType} can't be "${status}"`);
  }
}

export function createEntry(
  identity: ItemIdentity,
  metadata: { title: string; image: string },
  fields: TrackingFields & { status: Status },
) {
  assertStatusFits(identity.mediaType, fields.status);
  return db.transaction(() => {
    const row = upsertItem(identity, metadata.title, metadata.image);
    const tracked = applyTrackingRules(
      {
        ...fields,
        progress: fields.progress ?? 0,
        startDate: fields.startDate ?? null,
        endDate: fields.endDate ?? null,
      },
      // A new entry counts as a change of every field.
      { progress: true, status: true },
      maxProgressFor(identity.mediaType),
    );
    const { id } = db
      .insert(media)
      .values({ ...tracked, itemId: row.id })
      .returning({ id: media.id })
      .get();
    return getEntry(id)!;
  });
}

export function updateEntry(current: Entry, fields: TrackingFields) {
  assertStatusFits(current.item.mediaType, fields.status);
  return db.transaction(() => {
    const merged = { ...current, ...fields };
    const tracked = applyTrackingRules(
      {
        ...fields,
        status: merged.status,
        progress: merged.progress,
        startDate: merged.startDate,
        endDate: merged.endDate,
      },
      {
        progress:
          fields.progress !== undefined && fields.progress !== current.progress,
        status: fields.status !== undefined && fields.status !== current.status,
      },
      maxProgressFor(current.item.mediaType),
    );
    db.update(media).set(tracked).where(eq(media.id, current.id)).run();
    return getEntry(current.id)!;
  });
}

export function deleteEntry(id: number) {
  return (
    db
      .delete(media)
      .where(eq(media.id, id))
      .returning({ id: media.id })
      .get() !== undefined
  );
}

// Shows and seasons don't store progress or dates: they come from the
// episodes watched. Specials (season 0) don't count towards a show's progress.
function episodeStats(entries: Entry[]) {
  const seasonIds = entries
    .filter((entry) => entry.item.mediaType === "season")
    .map((entry) => entry.id);
  const showIds = entries
    .filter((entry) => entry.item.mediaType === "tv")
    .map((entry) => entry.id);

  const bySeason = seasonIds.length
    ? db
        .select({
          id: episode.seasonId,
          watched: countDistinct(episode.itemId),
          first: min(episode.endDate),
          last: max(episode.endDate),
        })
        .from(episode)
        .where(inArray(episode.seasonId, seasonIds))
        .groupBy(episode.seasonId)
        .all()
    : [];

  const seasonItem = sql`(SELECT ${item.seasonNumber} FROM ${item} WHERE ${item.id} = ${media.itemId})`;
  const byShow = showIds.length
    ? db
        .select({
          id: sql<number>`${media.parentId}`,
          watched: countDistinct(
            sql`CASE WHEN ${seasonItem} > 0 THEN ${episode.itemId} END`,
          ),
          first: min(episode.endDate),
          last: max(episode.endDate),
        })
        .from(episode)
        .innerJoin(media, eq(episode.seasonId, media.id))
        .where(inArray(media.parentId, showIds))
        .groupBy(media.parentId)
        .all()
    : [];

  return new Map([...bySeason, ...byShow].map((stats) => [stats.id, stats]));
}

export function withEpisodeStats(entries: Entry[]): Entry[] {
  const stats = episodeStats(entries);
  return entries.map((entry) => {
    if (entry.item.mediaType !== "tv" && entry.item.mediaType !== "season") {
      return entry;
    }
    const found = stats.get(entry.id);
    return {
      ...entry,
      progress: found?.watched ?? 0,
      startDate: found?.first ?? null,
      endDate: found?.last ?? null,
    };
  });
}

export function listEntries(filter: {
  mediaType?: MediaType;
  status?: Status;
}) {
  const entries = db
    .select(entryWithItem)
    .from(media)
    .innerJoin(item, eq(media.itemId, item.id))
    .where(
      and(
        filter.mediaType ? eq(item.mediaType, filter.mediaType) : undefined,
        filter.status ? eq(media.status, filter.status) : undefined,
      ),
    )
    .orderBy(item.title, item.seasonNumber)
    .all();
  return withEpisodeStats(entries);
}

export function entriesFor(identity: ItemIdentity) {
  return db
    .select(entryWithItem)
    .from(media)
    .innerJoin(item, eq(media.itemId, item.id))
    .where(sameItem(identity))
    .orderBy(media.createdAt)
    .all();
}

// Media ids among `mediaIds` that have at least one tracking entry.
export function trackedMediaIds(
  identity: Omit<ItemIdentity, "mediaId">,
  mediaIds: string[],
) {
  if (mediaIds.length === 0) return new Set<string>();
  const rows = db
    .selectDistinct({ mediaId: item.mediaId })
    .from(item)
    .innerJoin(media, eq(media.itemId, item.id))
    .where(
      and(
        eq(item.source, identity.source),
        eq(item.mediaType, identity.mediaType),
        inArray(item.mediaId, mediaIds),
      ),
    )
    .all();
  return new Set(rows.map((row) => row.mediaId));
}
