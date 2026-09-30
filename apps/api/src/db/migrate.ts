import { db } from "./index.ts";
import { runMigrations } from "./migrations.ts";

runMigrations(db);
