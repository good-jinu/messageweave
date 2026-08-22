import { drizzleAdapter } from "unadapter/drizzle";
import type { MessageWeaveStorageIdStrategy } from "../storage";
import { createUnadapterStorage } from "./unadapter";

/** Database client shape accepted by Unadapter's Drizzle integration. */
export type DrizzleDatabase = object;

/** Options for {@link drizzleStorage}. */
export interface DrizzleStorageOptions {
	/** Database provider used by the Drizzle client. */
	provider: "mysql" | "pg" | "sqlite";
	/** Drizzle table definitions keyed by MessageWeave model name. */
	schema?: Record<string, unknown>;
	/** Whether table names use Unadapter's plural naming convention. */
	usePlural?: boolean;
	/** Enable Unadapter query diagnostics. */
	debugLogs?: boolean;
	/** Must match the id strategy used when provisioning the schema. */
	idStrategy?: MessageWeaveStorageIdStrategy;
}

/** Create MessageWeave storage backed by a Drizzle database client. */
export function drizzleStorage(
	db: DrizzleDatabase,
	options: DrizzleStorageOptions,
) {
	const { idStrategy, ...adapterOptions } = options;
	return createUnadapterStorage(
		drizzleAdapter(db as Parameters<typeof drizzleAdapter>[0], adapterOptions),
		idStrategy,
	);
}
