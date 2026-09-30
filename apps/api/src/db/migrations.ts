import type { Database } from "bun:sqlite";
import { join } from "node:path";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

export const MIGRATIONS_FOLDER = join(import.meta.dir, "..", "..", "drizzle");

// drizzle-kit rebuilds a table to change a CHECK constraint and wraps it in
// PRAGMA foreign_keys=OFF, but SQLite ignores that pragma inside a transaction
// and the migrator runs in one: dropping the old table would cascade-delete
// every child row. Foreign keys are turned off before the transaction instead.
export function runMigrations(
  db: BunSQLiteDatabase<Record<string, unknown>> & { $client: Database },
  migrationsFolder = MIGRATIONS_FOLDER,
) {
  const sqlite = db.$client;
  sqlite.run("PRAGMA foreign_keys = OFF");
  try {
    migrate(db, { migrationsFolder });
    const violations = sqlite.query("PRAGMA foreign_key_check").all();
    if (violations.length > 0) {
      throw new Error(
        `Migrations left foreign key violations: ${JSON.stringify(violations)}`,
      );
    }
  } finally {
    sqlite.run("PRAGMA foreign_keys = ON");
  }
}
