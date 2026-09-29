// Declared here so the web app, which imports the App type from this file, can
// type-check the Bun-specific modules it pulls in.
/// <reference types="bun-types" />
import { Elysia, t } from "elysia";
import { auth, hasUser } from "./auth.ts";

// Everything lives under /api so the Vite dev server and a single-origin
// deployment can proxy it without CORS.
const app = new Elysia({ prefix: "/api" })
  // better-auth reads the raw request body itself.
  .all("/auth/*", ({ request }) => auth.handler(request), { parse: "none" })
  .get("/health", () => ({ status: "ok" as const }), {
    response: t.Object({ status: t.Literal("ok") }),
  })
  .get("/setup", () => ({ needsSetup: !hasUser() }), {
    response: t.Object({ needsSetup: t.Boolean() }),
  })
  .listen(3000);

console.log(`API running at ${app.server?.url}`);

export type App = typeof app;
