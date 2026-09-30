// Preloaded by bunfig.toml before any test file, so these are set before
// src/env.ts and src/db/index.ts read them.
Bun.env.DATABASE_PATH = ":memory:";
Bun.env.BETTER_AUTH_SECRET = "test-secret-at-least-32-characters-long";
Bun.env.BETTER_AUTH_URL = "http://localhost:5173";
Bun.env.TMDB_API = "test-key";

const { db } = await import("../src/db/index.ts");
const { runMigrations } = await import("../src/db/migrations.ts");

runMigrations(db);
