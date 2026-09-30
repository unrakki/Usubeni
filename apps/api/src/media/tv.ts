import { and, countDistinct, desc, eq, gt, inArray } from "drizzle-orm";
import { db } from "../db/index.ts";
import { episode, item, media } from "../db/schema.ts";
import { HttpError } from "../errors.ts";
import {
  getSeason,
  getShow,
  type SeasonMetadata,
  type ShowMetadata,
} from "../providers/tmdb.ts";
import {
  type Entry,
  getEntry,
  type ItemIdentity,
  type Status,
  upsertItem,
  withEpisodeStats,
} from "./service.ts";
import { refreshCaughtUp, seasonStatus, showStatus } from "./tracking.ts";

// A show and each of its seasons have at most one tracking entry; rewatches
// are extra episode viewings, not extra entries.

export interface EntryFields {
  status: Status;
  score?: number | null;
  notes?: string;
}

const showIdentity = (mediaId: string): ItemIdentity => ({
  source: "tmdb",
  mediaType: "tv",
  mediaId,
});

const seasonIdentity = (mediaId: string, seasonNumber: number) => ({
  ...showIdentity(mediaId),
  mediaType: "season" as const,
  seasonNumber,
});

function seasonSummary(show: ShowMetadata, seasonNumber: number) {
  const summary = show.seasons.find((s) => s.seasonNumber === seasonNumber);
  if (!summary) throw new HttpError(404, "Season not found on TMDB");
  return summary;
}

const entryForItem = (itemId: number) =>
  db.select().from(media).where(eq(media.itemId, itemId)).get();

function findShowEntry(mediaId: string) {
  const row = db
    .select({ id: media.id })
    .from(media)
    .innerJoin(item, eq(media.itemId, item.id))
    .where(
      and(
        eq(item.source, "tmdb"),
        eq(item.mediaType, "tv"),
        eq(item.mediaId, mediaId),
      ),
    )
    .get();
  return row ? getEntry(row.id)! : undefined;
}

function findSeasonEntries(showEntryId: number) {
  return db
    .select({ id: media.id })
    .from(media)
    .where(eq(media.parentId, showEntryId))
    .all()
    .map((row) => getEntry(row.id)!);
}

function ensureShowEntry(show: ShowMetadata, status: Status) {
  const row = upsertItem(showIdentity(show.mediaId), show.title, show.image);
  const existing = entryForItem(row.id);
  if (existing) return getEntry(existing.id)!;
  const { id } = db
    .insert(media)
    .values({ itemId: row.id, status })
    .returning({ id: media.id })
    .get();
  return getEntry(id)!;
}

function ensureSeasonEntry(
  show: ShowMetadata,
  seasonNumber: number,
  showEntryId: number,
  status: Status,
) {
  const summary = seasonSummary(show, seasonNumber);
  const row = upsertItem(
    seasonIdentity(show.mediaId, seasonNumber),
    show.title,
    summary.image || show.image,
  );
  const existing = entryForItem(row.id);
  if (existing) return getEntry(existing.id)!;
  const { id } = db
    .insert(media)
    .values({ itemId: row.id, parentId: showEntryId, status })
    .returning({ id: media.id })
    .get();
  return getEntry(id)!;
}

function watchedEpisodeNumbers(seasonEntryId: number) {
  const rows = db
    .selectDistinct({ number: item.episodeNumber })
    .from(episode)
    .innerJoin(item, eq(episode.itemId, item.id))
    .where(eq(episode.seasonId, seasonEntryId))
    .all();
  return new Set(rows.map((row) => row.number!));
}

function watchedShowEpisodes(showEntryId: number) {
  const seasonItem = db
    .select({ id: item.id })
    .from(item)
    .where(gt(item.seasonNumber, 0));
  const row = db
    .select({ watched: countDistinct(episode.itemId) })
    .from(episode)
    .innerJoin(media, eq(episode.seasonId, media.id))
    .where(
      and(eq(media.parentId, showEntryId), inArray(media.itemId, seasonItem)),
    )
    .get();
  return row?.watched ?? 0;
}

const setStatus = (entryId: number, status: Status) =>
  db.update(media).set({ status }).where(eq(media.id, entryId)).run();

function showCounts(show: ShowMetadata, showEntryId: number) {
  return {
    watched: watchedShowEpisodes(showEntryId),
    aired: show.seasons
      .filter((season) => season.seasonNumber > 0)
      .reduce((sum, season) => sum + season.airedEpisodeCount, 0),
    ended: show.ended,
  };
}

function seasonCounts(season: SeasonMetadata, seasonEntryId: number) {
  return {
    watched: watchedEpisodeNumbers(seasonEntryId).size,
    aired: season.episodes.filter((e) => e.aired).length,
    total: season.episodes.length,
  };
}

function reconcile(
  show: ShowMetadata,
  season: SeasonMetadata,
  showEntry: Entry,
  seasonEntry: Entry,
) {
  const current = getEntry(seasonEntry.id)!.status;
  setStatus(
    seasonEntry.id,
    seasonStatus(current, seasonCounts(season, seasonEntry.id)),
  );
  const showCurrent = getEntry(showEntry.id)!.status;
  setStatus(
    showEntry.id,
    showStatus(showCurrent, showCounts(show, showEntry.id)),
  );
}

// Marks every aired, unwatched episode as watched with an unknown date, so
// history and stats aren't skewed towards the day the season was completed.
function completeSeason(season: SeasonMetadata, seasonEntryId: number) {
  const watched = watchedEpisodeNumbers(seasonEntryId);
  for (const ep of season.episodes) {
    if (!ep.aired || watched.has(ep.episodeNumber)) continue;
    const row = upsertItem(
      {
        ...seasonIdentity(season.mediaId, season.seasonNumber),
        mediaType: "episode",
        episodeNumber: ep.episodeNumber,
      },
      ep.title,
      ep.image,
    );
    db.insert(episode)
      .values({ itemId: row.id, seasonId: seasonEntryId, endDate: null })
      .run();
  }
}

// Only a completed season is final; with unaired episodes it's caught up.
const completedStatus = (season: SeasonMetadata): Status =>
  season.episodes.every((e) => e.aired) ? "Completed" : "Caught up";

async function completeShow(show: ShowMetadata, showEntry: Entry) {
  const seasons = await Promise.all(
    show.seasons
      .filter((s) => s.seasonNumber > 0 && s.airedEpisodeCount > 0)
      .map((s) => getSeason(show.mediaId, s.seasonNumber)),
  );
  db.transaction(() => {
    for (const season of seasons) {
      const seasonEntry = ensureSeasonEntry(
        show,
        season.seasonNumber,
        showEntry.id,
        "In progress",
      );
      completeSeason(season, seasonEntry.id);
      setStatus(seasonEntry.id, completedStatus(season));
    }
    const counts = showCounts(show, showEntry.id);
    setStatus(showEntry.id, showStatus("In progress", counts));
  });
}

function applyFields(entryId: number, fields: EntryFields) {
  db.update(media)
    .set({ status: fields.status, score: fields.score, notes: fields.notes })
    .where(eq(media.id, entryId))
    .run();
}

export async function addShow(mediaId: string, fields: EntryFields) {
  const show = await getShow(mediaId);
  if (findShowEntry(mediaId)) {
    throw new HttpError(409, "This show is already tracked");
  }
  const showEntry = db.transaction(() => {
    const entry = ensureShowEntry(show, fields.status);
    applyFields(entry.id, fields);
    return entry;
  });
  if (fields.status === "Completed") await completeShow(show, showEntry);
  return withEpisodeStats([getEntry(showEntry.id)!])[0]!;
}

export async function addSeason(
  mediaId: string,
  seasonNumber: number,
  fields: EntryFields,
) {
  const [show, season] = await Promise.all([
    getShow(mediaId),
    getSeason(mediaId, seasonNumber),
  ]);
  const existingShow = findShowEntry(mediaId);
  const existingSeason =
    existingShow &&
    findSeasonEntries(existingShow.id).find(
      (entry) => entry.item.seasonNumber === seasonNumber,
    );
  if (existingSeason) {
    throw new HttpError(409, "This season is already tracked");
  }

  const seasonEntry = db.transaction(() => {
    const showEntry =
      existingShow ??
      ensureShowEntry(
        show,
        fields.status === "Planning" ? "Planning" : "In progress",
      );
    const entry = ensureSeasonEntry(
      show,
      seasonNumber,
      showEntry.id,
      fields.status,
    );
    applyFields(entry.id, fields);
    if (fields.status === "Completed") {
      completeSeason(season, entry.id);
      setStatus(entry.id, completedStatus(season));
      setStatus(
        showEntry.id,
        showStatus(
          getEntry(showEntry.id)!.status,
          showCounts(show, showEntry.id),
        ),
      );
    }
    return entry;
  });
  return withEpisodeStats([getEntry(seasonEntry.id)!])[0]!;
}

// Status changes on a show or season entry; other fields are set directly.
export async function updateShowOrSeason(
  entry: Entry,
  fields: Partial<EntryFields>,
) {
  const { mediaId } = entry.item;
  const statusChanged =
    fields.status !== undefined && fields.status !== entry.status;

  // Drizzle drops undefined keys, and an empty SET is an SQL error.
  if (Object.values(fields).some((value) => value !== undefined)) {
    db.update(media)
      .set({ score: fields.score, notes: fields.notes, status: fields.status })
      .where(eq(media.id, entry.id))
      .run();
  }

  if (statusChanged && entry.item.mediaType === "tv") {
    if (fields.status === "Completed") {
      await completeShow(await getShow(mediaId), entry);
    } else if (fields.status === "Dropped") {
      db.update(media)
        .set({ status: "Dropped" })
        .where(
          and(
            eq(media.parentId, entry.id),
            inArray(media.status, ["In progress", "Caught up"]),
          ),
        )
        .run();
    }
  }

  if (
    statusChanged &&
    entry.item.mediaType === "season" &&
    fields.status === "Completed"
  ) {
    const seasonNumber = entry.item.seasonNumber!;
    const [show, season] = await Promise.all([
      getShow(mediaId),
      getSeason(mediaId, seasonNumber),
    ]);
    db.transaction(() => {
      completeSeason(season, entry.id);
      setStatus(entry.id, completedStatus(season));
      const showEntry = getEntry(entry.parentId!)!;
      setStatus(
        showEntry.id,
        showStatus(showEntry.status, showCounts(show, showEntry.id)),
      );
    });
  }

  return withEpisodeStats([getEntry(entry.id)!])[0]!;
}

export async function watchEpisode(
  mediaId: string,
  seasonNumber: number,
  episodeNumber: number,
  endDate: Date | null,
) {
  const [show, season] = await Promise.all([
    getShow(mediaId),
    getSeason(mediaId, seasonNumber),
  ]);
  const ep = season.episodes.find((e) => e.episodeNumber === episodeNumber);
  if (!ep) throw new HttpError(404, "Episode not found on TMDB");
  // Progress and statuses count aired episodes. An episode without an air
  // date stays watchable: TMDB lacks dates for some old, aired episodes.
  if (ep.airDate !== null && !ep.aired) {
    throw new HttpError(422, "This episode hasn't aired yet");
  }

  db.transaction(() => {
    // The show and season entries are created on the first episode watched.
    const showEntry = ensureShowEntry(show, "In progress");
    const seasonEntry = ensureSeasonEntry(
      show,
      seasonNumber,
      showEntry.id,
      "In progress",
    );
    const row = upsertItem(
      {
        ...seasonIdentity(mediaId, seasonNumber),
        mediaType: "episode",
        episodeNumber,
      },
      ep.title,
      ep.image,
    );
    db.insert(episode)
      .values({ itemId: row.id, seasonId: seasonEntry.id, endDate })
      .run();
    reconcile(show, season, showEntry, seasonEntry);
  });
  return seasonView(show, season);
}

// Removes the latest viewing of an episode.
export async function unwatchEpisode(
  mediaId: string,
  seasonNumber: number,
  episodeNumber: number,
) {
  const [show, season] = await Promise.all([
    getShow(mediaId),
    getSeason(mediaId, seasonNumber),
  ]);
  const showEntry = findShowEntry(mediaId);
  const seasonEntry =
    showEntry &&
    findSeasonEntries(showEntry.id).find(
      (entry) => entry.item.seasonNumber === seasonNumber,
    );
  const viewing =
    seasonEntry &&
    db
      .select({ id: episode.id })
      .from(episode)
      .innerJoin(item, eq(episode.itemId, item.id))
      .where(
        and(
          eq(episode.seasonId, seasonEntry.id),
          eq(item.episodeNumber, episodeNumber),
        ),
      )
      .orderBy(desc(episode.id))
      .get();
  if (!showEntry || !seasonEntry || !viewing) {
    throw new HttpError(404, "This episode isn't watched");
  }

  db.transaction(() => {
    db.delete(episode).where(eq(episode.id, viewing.id)).run();
    reconcile(show, season, showEntry, seasonEntry);
  });
  return seasonView(show, season);
}

export async function showView(mediaId: string) {
  const show = await getShow(mediaId);
  const showEntry = findShowEntry(mediaId);
  const seasonEntries = showEntry ? findSeasonEntries(showEntry.id) : [];

  if (showEntry) {
    db.transaction(() => {
      for (const seasonEntry of seasonEntries) {
        const summary = show.seasons.find(
          (s) => s.seasonNumber === seasonEntry.item.seasonNumber,
        );
        if (!summary) continue;
        const counts = {
          watched: watchedEpisodeNumbers(seasonEntry.id).size,
          aired: summary.airedEpisodeCount,
          total: summary.episodeCount,
        };
        setStatus(
          seasonEntry.id,
          refreshCaughtUp(
            seasonEntry.status,
            seasonStatus(seasonEntry.status, counts),
          ),
        );
      }
      setStatus(
        showEntry.id,
        refreshCaughtUp(
          showEntry.status,
          showStatus(showEntry.status, showCounts(show, showEntry.id)),
        ),
      );
    });
  }

  const [entry, ...seasons] = withEpisodeStats(
    [showEntry, ...seasonEntries]
      .filter((e): e is Entry => e !== undefined)
      .map((e) => getEntry(e.id)!),
  );
  return {
    ...show,
    entry: entry ?? null,
    seasons: show.seasons.map((summary) => ({
      ...summary,
      entry:
        seasons.find((s) => s.item.seasonNumber === summary.seasonNumber) ??
        null,
    })),
  };
}

function seasonView(show: ShowMetadata, season: SeasonMetadata) {
  const showEntry = findShowEntry(show.mediaId);
  const seasonEntry =
    showEntry &&
    findSeasonEntries(showEntry.id).find(
      (entry) => entry.item.seasonNumber === season.seasonNumber,
    );
  const viewings = seasonEntry
    ? db
        .select({
          id: episode.id,
          episodeNumber: item.episodeNumber,
          endDate: episode.endDate,
        })
        .from(episode)
        .innerJoin(item, eq(episode.itemId, item.id))
        .where(eq(episode.seasonId, seasonEntry.id))
        .orderBy(episode.id)
        .all()
    : [];

  return {
    ...season,
    showTitle: show.title,
    entry: seasonEntry
      ? withEpisodeStats([getEntry(seasonEntry.id)!])[0]!
      : null,
    episodes: season.episodes.map((ep) => ({
      ...ep,
      viewings: viewings
        .filter((v) => v.episodeNumber === ep.episodeNumber)
        .map(({ id, endDate }) => ({ id, endDate })),
    })),
  };
}

export async function getSeasonView(mediaId: string, seasonNumber: number) {
  const [show, season] = await Promise.all([
    getShow(mediaId),
    getSeason(mediaId, seasonNumber),
  ]);
  const showEntry = findShowEntry(mediaId);
  const seasonEntry =
    showEntry &&
    findSeasonEntries(showEntry.id).find(
      (entry) => entry.item.seasonNumber === seasonNumber,
    );
  if (seasonEntry) {
    setStatus(
      seasonEntry.id,
      refreshCaughtUp(
        seasonEntry.status,
        seasonStatus(seasonEntry.status, seasonCounts(season, seasonEntry.id)),
      ),
    );
  }
  return seasonView(show, season);
}
