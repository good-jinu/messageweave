import { prismaAdapter } from "unadapter/prisma";
import type { MessageWeaveStorageIdStrategy } from "../storage";
import { createUnadapterStorage } from "./unadapter";

/** Options for {@link prismaStorage}. */
export interface PrismaStorageOptions {
	/** Database provider configured in `schema.prisma`. */
	provider:
		| "cockroachdb"
		| "mongodb"
		| "mysql"
		| "postgresql"
		| "sqlite"
		| "sqlserver";
	/** Whether Prisma model accessors use plural names. */
	usePlural?: boolean;
	/** Enable Unadapter query diagnostics. */
	debugLogs?: boolean;
	/** Must match the id strategy used when provisioning the schema. */
	idStrategy?: MessageWeaveStorageIdStrategy;
}

/** Create MessageWeave storage backed by a Prisma client. */
export function prismaStorage(prisma: object, options: PrismaStorageOptions) {
	const { idStrategy, ...adapterOptions } = options;
	return createUnadapterStorage(
		prismaAdapter(prisma, adapterOptions),
		idStrategy,
	);
}
