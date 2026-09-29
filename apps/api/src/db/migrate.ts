import { join } from "node:path";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db } from "./index.ts";

migrate(db, { migrationsFolder: join(import.meta.dir, "..", "..", "drizzle") });
