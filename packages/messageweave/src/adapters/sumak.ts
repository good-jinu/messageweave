import type { Sumak } from "sumak";
import { sumakAdapter } from "unadapter/sumak";
import type { MessageWeaveStorageIdStrategy } from "../storage";
import { createUnadapterStorage } from "./unadapter";

/** SQL dialect used by a Sumak-backed MessageWeave store. */
export type SumakStorageDialect = "mssql" | "mysql" | "postgres" | "sqlite";

/** Options for {@link sumakStorage}. */
export interface SumakStorageOptions {
	/** Database dialect used by the Sumak client. */
	type?: SumakStorageDialect;
	/** Whether table names use Unadapter's plural naming convention. */
	usePlural?: boolean;
	/** Enable Unadapter query diagnostics. */
	debugLogs?: boolean;
	/** Must match the id strategy used when provisioning the schema. */
	idStrategy?: MessageWeaveStorageIdStrategy;
}

/** Create MessageWeave storage backed by a Sumak database client. */
export function sumakStorage<Database>(
	db: Sumak<Database>,
	options?: SumakStorageOptions,
) {
	const { idStrategy, ...adapterOptions } = options ?? {};
	return createUnadapterStorage(sumakAdapter(db, adapterOptions), idStrategy);
}
