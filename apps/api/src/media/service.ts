import { and, eq, getTableColumns, inArray, isNull } from "drizzle-orm";
import type { MEDIA_TYPES, SOURCES, STATUSES } from "../db/constants.ts";
import { db } from "../db/index.ts";
import { item, media } from "../db/schema.ts";
import { applyTrackingRules } from "./tracking.ts";

type MediaType = (typeof MEDIA_TYPES)[number];
type Source = (typeof SOURCES)[number];
type Status = (typeof STATUSES)[number];

export interface ItemIdentity {
  source: Source;
  mediaType: MediaType;
  mediaId: string;
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
  },
};

const sameItem = (identity: ItemIdentity) =>
  and(
    eq(item.source, identity.source),
    eq(item.mediaType, identity.mediaType),
    eq(item.mediaId, identity.mediaId),
    isNull(item.seasonNumber),
    isNull(item.episodeNumber),
  );

// Keeps the stored title and poster in sync with the provider on each add.
function upsertItem(identity: ItemIdentity, title: string, image: string) {
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

function getEntry(id: number) {
  return db
    .select(entryWithItem)
    .from(media)
    .innerJoin(item, eq(media.itemId, item.id))
    .where(eq(media.id, id))
    .get();
}

export function createEntry(
  identity: ItemIdentity,
  metadata: { title: string; image: string },
  fields: TrackingFields & { status: Status },
) {
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

export function updateEntry(id: number, fields: TrackingFields) {
  return db.transaction(() => {
    const current = getEntry(id);
    if (!current) return undefined;

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
    db.update(media).set(tracked).where(eq(media.id, id)).run();
    return getEntry(id)!;
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

export function listEntries(filter: {
  mediaType?: MediaType;
  status?: Status;
}) {
  return db
    .select(entryWithItem)
    .from(media)
    .innerJoin(item, eq(media.itemId, item.id))
    .where(
      and(
        filter.mediaType ? eq(item.mediaType, filter.mediaType) : undefined,
        filter.status ? eq(media.status, filter.status) : undefined,
      ),
    )
    .orderBy(item.title)
    .all();
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
