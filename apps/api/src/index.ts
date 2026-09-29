import { Elysia, t } from "elysia";

const WEB_ORIGIN = "http://localhost:5173";

const app = new Elysia()
  // Minimal CORS so the Vite dev server can reach the API; swap for @elysiajs/cors once non-simple requests are needed.
  .onRequest(({ set }) => {
    set.headers["access-control-allow-origin"] = WEB_ORIGIN;
  })
  .get("/health", () => ({ status: "ok" as const }), {
    response: t.Object({ status: t.Literal("ok") }),
  })
  .listen(3000);

console.log(`API running at ${app.server?.url}`);

export type App = typeof app;
