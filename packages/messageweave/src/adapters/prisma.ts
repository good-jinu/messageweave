import { prismaAdapter as unadapterPrisma } from "unadapter/prisma";
import type { MessageWeaveStorageIdStrategy } from "../storage";
import { createUnadapterStorage } from "./unadapter";

/** Options for {@link prismaAdapter}. */
export interface PrismaAdapterOptions {
	/** Database provider configured in `schema.prisma`. Optional, will attempt to infer from client if missing. */
	provider?:
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
export function prismaAdapter(prisma: object, options?: PrismaAdapterOptions) {
	const { idStrategy, provider, ...adapterOptions } = options ?? {};

	const inferredProvider = provider ?? (prisma as any)?._engineConfig?.activeProvider ?? (prisma as any)?._activeProvider;
	if (!inferredProvider) {
		throw new Error(
			"Could not infer Prisma provider from client. Please provide the `provider` option explicitly.",
		);
	}

	return createUnadapterStorage(
		unadapterPrisma(prisma, { provider: inferredProvider, ...adapterOptions }),
		idStrategy,
	);
}
