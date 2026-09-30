import { Database } from "bun:sqlite";
import { afterAll, expect, test } from "bun:test";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { MIGRATIONS_FOLDER, runMigrations } from "../src/db/migrations.ts";

const tempDirs: string[] = [];
afterAll(() =>
  Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true }))),
);

// A copy of the migrations folder that stops after the first `count` entries.
async function migrationsUpTo(count: number) {
  const dir = await mkdtemp(join(tmpdir(), "usubeni-migrations-"));
  tempDirs.push(dir);
  await cp(MIGRATIONS_FOLDER, dir, { recursive: true });
  const journalPath = join(dir, "meta", "_journal.json");
  const journal = await Bun.file(journalPath).json();
  journal.entries = journal.entries.slice(0, count);
  await Bun.write(journalPath, JSON.stringify(journal));
  return dir;
}

test("rebuilding media keeps seasons and episodes that reference it", async () => {
  const sqlite = new Database(":memory:");
  sqlite.run("PRAGMA foreign_keys = ON");
  const db = drizzle({ client: sqlite });

  // 0003 rebuilds media to add a status; seed data just before it.
  runMigrations(db, await migrationsUpTo(3));
  sqlite.run(
    `INSERT INTO item (id, media_id, source, media_type, title, image, season_number, episode_number) VALUES
      (1, 'show', 'tmdb', 'tv', 'Show', '', NULL, NULL),
      (2, 'show', 'tmdb', 'season', 'Show', '', 1, NULL),
      (3, 'show', 'tmdb', 'episode', 'Show', '', 1, 1)`,
  );
  sqlite.run(
    "INSERT INTO media (id, item_id, parent_id, status) VALUES (1, 1, NULL, 'In progress'), (2, 2, 1, 'In progress')",
  );
  sqlite.run("INSERT INTO episode (item_id, season_id) VALUES (3, 2)");

  runMigrations(db);

  expect(
    sqlite
      .query(
        "SELECT (SELECT count(*) FROM media) AS media, (SELECT count(*) FROM episode) AS episodes",
      )
      .get(),
  ).toEqual({ media: 2, episodes: 1 });
  expect(sqlite.query("PRAGMA foreign_keys").get()).toEqual({
    foreign_keys: 1,
  });
});
