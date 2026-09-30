import { Elysia, t } from "elysia";
import { authGuard } from "../auth.ts";
import { trackedMediaIds } from "../media/service.ts";
import { searchMovies } from "../providers/tmdb.ts";

export const searchRoutes = new Elysia({ prefix: "/search" })
  .use(authGuard)
  .get(
    "/",
    async ({ query }) => {
      const data = await searchMovies(query.q, query.page ?? 1);
      const tracked = trackedMediaIds(
        { source: "tmdb", mediaType: "movie" },
        data.results.map((result) => result.mediaId),
      );
      return {
        ...data,
        results: data.results.map((result) => ({
          ...result,
          tracked: tracked.has(result.mediaId),
        })),
      };
    },
    {
      auth: true,
      query: t.Object({
        type: t.Literal("movie"),
        q: t.String({ minLength: 1 }),
        page: t.Optional(t.Integer({ minimum: 1 })),
      }),
    },
  );
