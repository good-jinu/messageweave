import type Database from "better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

export interface EnsureMessageWeaveSchemaOptions {
	db: BetterSQLite3Database<Record<string, unknown>>;
	sqlite: Database.Database;
	migrationsFolder: string;
}

export function ensureMessageWeaveSchema({
	db,
	sqlite,
	migrationsFolder,
}: EnsureMessageWeaveSchemaOptions): void {
	sqlite.pragma("foreign_keys = ON");
	migrate(db, { migrationsFolder });
}
