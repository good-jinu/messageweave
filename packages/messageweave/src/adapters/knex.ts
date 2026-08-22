import type { Knex } from "knex";
import { knexAdapter } from "unadapter/knex";
import type { MessageWeaveStorageIdStrategy } from "../storage";
import { createUnadapterStorage } from "./unadapter";

/** SQL dialect used by a Knex-backed MessageWeave store. */
export type KnexStorageDialect = "mssql" | "mysql" | "postgres" | "sqlite";

/** Options for {@link knexStorage}. */
export interface KnexStorageOptions {
	/** Database dialect used by the Knex client. */
	type?: KnexStorageDialect;
	/** Whether table names use Unadapter's plural naming convention. */
	usePlural?: boolean;
	/** Enable Unadapter query diagnostics. */
	debugLogs?: boolean;
	/** Must match the id strategy used when provisioning the schema. */
	idStrategy?: MessageWeaveStorageIdStrategy;
}

/** Create MessageWeave storage backed by a Knex database client. */
export function knexStorage(db: Knex, options?: KnexStorageOptions) {
	const { idStrategy, ...adapterOptions } = options ?? {};
	return createUnadapterStorage(knexAdapter(db, adapterOptions), idStrategy);
}
