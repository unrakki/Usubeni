import { Database } from "bun:sqlite";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema.ts";

// Same file as drizzle.config.ts, resolved from here so the cwd doesn't matter.
const sqlite = new Database(join(import.meta.dir, "..", "..", "db.sqlite"), {
  create: true,
});
// SQLite ships with foreign keys off; the ON DELETE CASCADE clauses need them.
sqlite.run("PRAGMA foreign_keys = ON");

export const db = drizzle({ client: sqlite, schema });
