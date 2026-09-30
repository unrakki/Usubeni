import { Elysia, t } from "elysia";
import { auth, hasUser } from "./auth.ts";
import { mediaRoutes } from "./routes/media.ts";
import { searchRoutes } from "./routes/search.ts";

// Everything lives under /api so the Vite dev server and a single-origin
// deployment can proxy it without CORS. Kept apart from listen() for tests.
export const app = new Elysia({ prefix: "/api" })
  // better-auth reads the raw request body itself.
  .all("/auth/*", ({ request }) => auth.handler(request), { parse: "none" })
  .get("/health", () => ({ status: "ok" as const }), {
    response: t.Object({ status: t.Literal("ok") }),
  })
  .get("/setup", () => ({ needsSetup: !hasUser() }), {
    response: t.Object({ needsSetup: t.Boolean() }),
  })
  .use(searchRoutes)
  .use(mediaRoutes);
