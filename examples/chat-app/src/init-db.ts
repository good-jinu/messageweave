import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./db/schema/index.js";
import { ensureMessageWeaveSchema } from "./schema.js";

const projectDir = fileURLToPath(new URL("../", import.meta.url));
const migrationsFolder = join(projectDir, "drizzle");
const databasePath =
	process.env.DATABASE_URL ?? join(projectDir, "data", "messageweave.sqlite");

await mkdir(dirname(databasePath), { recursive: true });

const sqlite = new Database(databasePath);
const db = drizzle(sqlite, { schema });
try {
	ensureMessageWeaveSchema({ db, sqlite, migrationsFolder });
	console.log(`MessageWeave schema is ready: ${databasePath}`);
} finally {
	sqlite.close();
}
