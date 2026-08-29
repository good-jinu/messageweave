import type { Kysely } from "kysely";
import { kyselyAdapter as unadapterKysely } from "unadapter/kysely";
import type { MessageWeaveStorageIdStrategy } from "../storage";
import { createUnadapterStorage } from "./unadapter";

/** SQL dialect used by a Kysely-backed MessageWeave store. */
export type KyselyAdapterDialect = "mssql" | "mysql" | "postgres" | "sqlite";

/** Options for {@link kyselyAdapter}. */
export interface KyselyAdapterOptions {
	/** Database dialect used by the Kysely client. */
	type?: KyselyAdapterDialect;
	/** Whether table names use Unadapter's plural naming convention. */
	usePlural?: boolean;
	/** Enable Unadapter query diagnostics. */
	debugLogs?: boolean;
	/** Must match the id strategy used when provisioning the schema. */
	idStrategy?: MessageWeaveStorageIdStrategy;
}

/** Create MessageWeave storage backed by a Kysely database client. */
export function kyselyAdapter<Database>(
	db: Kysely<Database>,
	options?: KyselyAdapterOptions,
) {
	const { idStrategy, ...adapterOptions } = options ?? {};
	return createUnadapterStorage(
		unadapterKysely(db, adapterOptions),
		idStrategy,
	);
}
