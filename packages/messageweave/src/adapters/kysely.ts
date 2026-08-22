import type { Kysely } from "kysely";
import { kyselyAdapter } from "unadapter/kysely";
import type { MessageWeaveStorageIdStrategy } from "../storage";
import { createUnadapterStorage } from "./unadapter";

/** SQL dialect used by a Kysely-backed MessageWeave store. */
export type KyselyStorageDialect = "mssql" | "mysql" | "postgres" | "sqlite";

/** Options for {@link kyselyStorage}. */
export interface KyselyStorageOptions {
	/** Database dialect used by the Kysely client. */
	type?: KyselyStorageDialect;
	/** Whether table names use Unadapter's plural naming convention. */
	usePlural?: boolean;
	/** Enable Unadapter query diagnostics. */
	debugLogs?: boolean;
	/** Must match the id strategy used when provisioning the schema. */
	idStrategy?: MessageWeaveStorageIdStrategy;
}

/** Create MessageWeave storage backed by a Kysely database client. */
export function kyselyStorage<Database>(
	db: Kysely<Database>,
	options?: KyselyStorageOptions,
) {
	const { idStrategy, ...adapterOptions } = options ?? {};
	return createUnadapterStorage(kyselyAdapter(db, adapterOptions), idStrategy);
}
