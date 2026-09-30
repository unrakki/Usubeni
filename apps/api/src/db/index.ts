import { Database } from "bun:sqlite";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as authSchema from "./auth-schema.ts";
import * as schema from "./schema.ts";

// Defaults to the file drizzle.config.ts uses, resolved from here so the cwd
// doesn't matter. Tests set DATABASE_PATH to ":memory:".
const sqlite = new Database(
  Bun.env.DATABASE_PATH || join(import.meta.dir, "..", "..", "db.sqlite"),
  { create: true },
);
// SQLite ships with foreign keys off; the ON DELETE CASCADE clauses need them.
sqlite.run("PRAGMA foreign_keys = ON");

export const db = drizzle({
  client: sqlite,
  schema: { ...schema, ...authSchema },
});
