import { createSchemaFactory } from "drizzle-typebox";
import { Elysia, t } from "elysia";
import { MEDIA_TYPES, STATUSES } from "../db/constants.ts";
import { media } from "../db/schema.ts";
import { authGuard } from "../auth.ts";
import { HttpError } from "../errors.ts";
import {
  createEntry,
  deleteEntry,
  entriesFor,
  getEntry,
  listEntries,
  updateEntry,
} from "../media/service.ts";
import {
  addSeason,
  addShow,
  getSeasonView,
  showView,
  unwatchEpisode,
  updateShowOrSeason,
  watchEpisode,
} from "../media/tv.ts";
import { getMovie } from "../providers/tmdb.ts";

// Elysia's `t` so date columns accept ISO strings from JSON bodies.
const { createInsertSchema, createUpdateSchema } = createSchemaFactory({
  typeboxInstance: t,
});

const TRACKING_FIELDS = [
  "status",
  "score",
  "progress",
  "startDate",
  "endDate",
  "notes",
] as const;

const refine = {
  score: () => t.Number({ minimum: 0, maximum: 10 }),
  progress: () => t.Integer({ minimum: 0 }),
};

// Status is required so adding never falls back to a hidden default; the other
// fields have one. Partial also restores the optionality drizzle-typebox drops
// from refined fields' types.
const insertSchema = createInsertSchema(media, refine);
const createFields = t.Composite([
  t.Partial(t.Pick(insertSchema, TRACKING_FIELDS)),
  t.Required(t.Pick(insertSchema, ["status"])),
]);
// Shows and seasons derive progress and dates from the episodes watched.
const createShowFields = t.Composite([
  t.Partial(t.Pick(insertSchema, ["score", "notes"])),
  t.Required(t.Pick(insertSchema, ["status"])),
]);
const updateFields = t.Pick(createUpdateSchema(media, refine), TRACKING_FIELDS);

const idParams = t.Object({ id: t.Number() });
const showParams = t.Object({ mediaId: t.String() });
const seasonParams = t.Object({
  mediaId: t.String(),
  seasonNumber: t.Integer({ minimum: 0 }),
});
const episodeParams = t.Object({
  mediaId: t.String(),
  seasonNumber: t.Integer({ minimum: 0 }),
  episodeNumber: t.Integer({ minimum: 1 }),
});

// Not t.UnionEnum: Elysia 1.4 fills an absent optional UnionEnum query param
// with its first value, which silently turned "no filter" into a filter.
const oneOf = <const T extends readonly string[]>(values: T) =>
  t.Union(values.map((value) => t.Literal(value as T[number])));

const tmdb = { source: t.Literal("tmdb"), mediaId: t.String({ minLength: 1 }) };

function findEntry(id: number) {
  const entry = getEntry(id);
  if (!entry) throw new HttpError(404, "Not found");
  return entry;
}

export const mediaRoutes = new Elysia({ prefix: "/media" })
  .use(authGuard)
  .get(
    "/",
    ({ query }) => listEntries({ mediaType: query.type, status: query.status }),
    {
      auth: true,
      query: t.Object({
        type: t.Optional(oneOf(MEDIA_TYPES)),
        status: t.Optional(oneOf(STATUSES)),
      }),
    },
  )
  .get(
    "/tmdb/movie/:mediaId",
    async ({ params }) => {
      const metadata = await getMovie(params.mediaId);
      const entries = entriesFor({
        source: "tmdb",
        mediaType: "movie",
        mediaId: metadata.mediaId,
      });
      return { ...metadata, entries };
    },
    { auth: true, params: showParams },
  )
  .get("/tmdb/tv/:mediaId", ({ params }) => showView(params.mediaId), {
    auth: true,
    params: showParams,
  })
  .get(
    "/tmdb/tv/:mediaId/season/:seasonNumber",
    ({ params }) => getSeasonView(params.mediaId, params.seasonNumber),
    { auth: true, params: seasonParams },
  )
  .post(
    "/tmdb/tv/:mediaId/season/:seasonNumber/episode/:episodeNumber/watch",
    ({ params, body }) =>
      watchEpisode(
        params.mediaId,
        params.seasonNumber,
        params.episodeNumber,
        // No body means "watched now"; an explicit null means "date unknown".
        body?.endDate === undefined ? new Date() : body.endDate,
      ),
    {
      auth: true,
      params: episodeParams,
      body: t.Optional(t.Object({ endDate: t.Optional(t.Nullable(t.Date())) })),
    },
  )
  .delete(
    "/tmdb/tv/:mediaId/season/:seasonNumber/episode/:episodeNumber/watch",
    ({ params }) =>
      unwatchEpisode(params.mediaId, params.seasonNumber, params.episodeNumber),
    { auth: true, params: episodeParams },
  )
  .post(
    "/",
    async ({ body, status }) => {
      if (body.mediaType === "tv") {
        const { mediaId, status: entryStatus, score, notes } = body;
        return status(
          201,
          await addShow(mediaId, { status: entryStatus, score, notes }),
        );
      }
      if (body.mediaType === "season") {
        const {
          mediaId,
          seasonNumber,
          status: entryStatus,
          score,
          notes,
        } = body;
        return status(
          201,
          await addSeason(mediaId, seasonNumber, {
            status: entryStatus,
            score,
            notes,
          }),
        );
      }
      const { source, mediaType, mediaId, ...fields } = body;
      // Title and poster come from the provider, not the client.
      const metadata = await getMovie(mediaId);
      return status(
        201,
        createEntry({ source, mediaType, mediaId }, metadata, fields),
      );
    },
    {
      auth: true,
      body: t.Union([
        t.Object({
          ...tmdb,
          mediaType: t.Literal("movie"),
          ...createFields.properties,
        }),
        t.Object({
          ...tmdb,
          mediaType: t.Literal("tv"),
          ...createShowFields.properties,
        }),
        t.Object({
          ...tmdb,
          mediaType: t.Literal("season"),
          seasonNumber: t.Integer({ minimum: 0 }),
          ...createShowFields.properties,
        }),
      ]),
    },
  )
  .patch(
    "/:id",
    ({ params, body }) => {
      const entry = findEntry(params.id);
      if (entry.item.mediaType !== "tv" && entry.item.mediaType !== "season") {
        return updateEntry(entry, body);
      }
      const { progress, startDate, endDate, ...fields } = body;
      if (
        progress !== undefined ||
        startDate !== undefined ||
        endDate !== undefined
      ) {
        throw new HttpError(
          422,
          "Progress and dates of shows and seasons come from watched episodes",
        );
      }
      return updateShowOrSeason(entry, fields);
    },
    { auth: true, params: idParams, body: updateFields },
  )
  .delete(
    "/:id",
    ({ params, status }) =>
      deleteEntry(params.id)
        ? status(204, undefined)
        : status(404, { message: "Not found" }),
    { auth: true, params: idParams },
  );
