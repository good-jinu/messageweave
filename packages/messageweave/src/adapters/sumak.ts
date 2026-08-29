import type { Sumak } from "sumak";
import { sumakAdapter as unadapterSumak } from "unadapter/sumak";
import type { MessageWeaveStorageIdStrategy } from "../storage";
import { createUnadapterStorage } from "./unadapter";

/** SQL dialect used by a Sumak-backed MessageWeave store. */
export type SumakAdapterDialect = "mssql" | "mysql" | "postgres" | "sqlite";

/** Options for {@link sumakAdapter}. */
export interface SumakAdapterOptions {
	/** Database dialect used by the Sumak client. */
	type?: SumakAdapterDialect;
	/** Whether table names use Unadapter's plural naming convention. */
	usePlural?: boolean;
	/** Enable Unadapter query diagnostics. */
	debugLogs?: boolean;
	/** Must match the id strategy used when provisioning the schema. */
	idStrategy?: MessageWeaveStorageIdStrategy;
}

/** Create MessageWeave storage backed by a Sumak database client. */
export function sumakAdapter<Database>(
	db: Sumak<Database>,
	options?: SumakAdapterOptions,
) {
	const { idStrategy, ...adapterOptions } = options ?? {};
	return createUnadapterStorage(unadapterSumak(db, adapterOptions), idStrategy);
}
