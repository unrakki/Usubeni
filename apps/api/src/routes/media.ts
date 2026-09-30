import { createSchemaFactory } from "drizzle-typebox";
import { Elysia, t } from "elysia";
import { MEDIA_TYPES, STATUSES } from "../db/constants.ts";
import { media } from "../db/schema.ts";
import { authGuard } from "../auth.ts";
import {
  createEntry,
  deleteEntry,
  entriesFor,
  listEntries,
  updateEntry,
} from "../media/service.ts";
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
const updateFields = t.Pick(createUpdateSchema(media, refine), TRACKING_FIELDS);

const idParams = t.Object({ id: t.Number() });

// Not t.UnionEnum: Elysia 1.4 fills an absent optional UnionEnum query param
// with its first value, which silently turned "no filter" into a filter.
const oneOf = <const T extends readonly string[]>(values: T) =>
  t.Union(values.map((value) => t.Literal(value as T[number])));

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
    { auth: true, params: t.Object({ mediaId: t.String() }) },
  )
  .post(
    "/",
    async ({ body: { source, mediaType, mediaId, ...fields }, status }) => {
      // Title and poster come from the provider, not the client.
      const metadata = await getMovie(mediaId);
      return status(
        201,
        createEntry({ source, mediaType, mediaId }, metadata, fields),
      );
    },
    {
      auth: true,
      body: t.Object({
        source: t.Literal("tmdb"),
        mediaType: t.Literal("movie"),
        mediaId: t.String({ minLength: 1 }),
        ...createFields.properties,
      }),
    },
  )
  .patch(
    "/:id",
    ({ params, body, status }) =>
      updateEntry(params.id, body) ?? status(404, { message: "Not found" }),
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
