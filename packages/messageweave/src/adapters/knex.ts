import type { Knex } from "knex";
import { knexAdapter as unadapterKnex } from "unadapter/knex";
import type { MessageWeaveStorageIdStrategy } from "../storage";
import { createUnadapterStorage } from "./unadapter";

/** SQL dialect used by a Knex-backed MessageWeave store. */
export type KnexAdapterDialect = "mssql" | "mysql" | "postgres" | "sqlite";

/** Options for {@link knexAdapter}. */
export interface KnexAdapterOptions {
	/** Database dialect used by the Knex client. */
	type?: KnexAdapterDialect;
	/** Whether table names use Unadapter's plural naming convention. */
	usePlural?: boolean;
	/** Enable Unadapter query diagnostics. */
	debugLogs?: boolean;
	/** Must match the id strategy used when provisioning the schema. */
	idStrategy?: MessageWeaveStorageIdStrategy;
}

/** Create MessageWeave storage backed by a Knex database client. */
export function knexAdapter(db: Knex, options?: KnexAdapterOptions) {
	const { idStrategy, ...adapterOptions } = options ?? {};
	return createUnadapterStorage(unadapterKnex(db, adapterOptions), idStrategy);
}
