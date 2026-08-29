import type {
	DrizzleDialect as UnadapterDrizzleDialect,
	PrismaProvider as UnadapterPrismaProvider,
} from "unadapter/generate";
import { generate } from "unadapter/generate";
import { getMessageWeaveTables } from "./schema";

/** Supported database dialects for Drizzle schema generation. */
export type MessageWeaveDrizzleDialect = UnadapterDrizzleDialect;

/** Supported database providers for Prisma schema generation. */
export type MessageWeavePrismaProvider = UnadapterPrismaProvider;

/** Supported primary-key strategies for generated database schemas. */
export type MessageWeaveSchemaIdStrategy =
	| "number"
	| "serial"
	| "string"
	| "uuid";

/** Options for generating Drizzle ORM schema definitions. */
export interface GenerateDrizzleSchemaOptions {
	/** Target database dialect for Drizzle ORM. */
	dialect: MessageWeaveDrizzleDialect;
	/**
	 * Primary-key strategy for the generated `id` columns.
	 *
	 * @default "string"
	 */
	idStrategy?: MessageWeaveSchemaIdStrategy;
}

/** Options for generating Prisma schema model definitions. */
export interface GeneratePrismaSchemaOptions {
	/**
	 * Target database provider for Prisma.
	 *
	 * @default "postgresql"
	 */
	provider?: MessageWeavePrismaProvider;
	/**
	 * Alias for `provider`.
	 */
	dialect?: MessageWeavePrismaProvider;
	/**
	 * Whether to include `generator client` and `datasource db` blocks at the top.
	 *
	 * @default false
	 */
	includeDatasource?: boolean;
	/**
	 * Primary-key strategy for the generated `id` columns.
	 *
	 * @default "string"
	 */
	idStrategy?: MessageWeaveSchemaIdStrategy;
}

/** Options for generating Drizzle schema via the unified generator. */
export interface GenerateMessageWeaveDrizzleSchemaOptions
	extends GenerateDrizzleSchemaOptions {
	/** Format identifier specifying Drizzle ORM generation. */
	format: "drizzle";
}

/** Options for generating Prisma schema via the unified generator. */
export interface GenerateMessageWeavePrismaSchemaOptions
	extends GeneratePrismaSchemaOptions {
	/** Format identifier specifying Prisma schema generation. */
	format: "prisma";
}

/** Unified schema generation options for MessageWeave tables. */
export type GenerateMessageWeaveSchemaOptions =
	| GenerateMessageWeaveDrizzleSchemaOptions
	| GenerateMessageWeavePrismaSchemaOptions;

/**
 * Generate Drizzle ORM TypeScript schema code for MessageWeave tables.
 */
export async function generateDrizzleSchema(
	options: GenerateDrizzleSchemaOptions,
): Promise<string> {
	return generate(
		getMessageWeaveTables,
		{
			advanced: {
				database: toAdvancedDatabaseOptions(options.idStrategy ?? "string"),
			},
		},
		{
			format: "drizzle",
			dialect: options.dialect,
		},
	);
}

/**
 * Generate Prisma schema definition string for MessageWeave models.
 */
export async function generatePrismaSchema(
	options: GeneratePrismaSchemaOptions = {},
): Promise<string> {
	const provider = options.provider ?? options.dialect ?? "postgresql";
	return generate(
		getMessageWeaveTables,
		{
			advanced: {
				database: toAdvancedDatabaseOptions(options.idStrategy ?? "string"),
			},
		},
		{
			format: "prisma",
			provider,
			includeDatasource: options.includeDatasource,
		},
	);
}

/**
 * Generate schema code for MessageWeave tables in the specified format (Drizzle or Prisma).
 */
export async function generateMessageWeaveSchema(
	options: GenerateMessageWeaveSchemaOptions,
): Promise<string> {
	if (options.format === "drizzle") {
		return generateDrizzleSchema(options);
	}
	if (options.format === "prisma") {
		return generatePrismaSchema(options);
	}
	throw new Error(
		`Unsupported schema format: ${(options as { format: string }).format}`,
	);
}

function toAdvancedDatabaseOptions(idStrategy: MessageWeaveSchemaIdStrategy): {
	generateId?: "serial" | "uuid";
	useNumberId?: true;
} {
	if (idStrategy === "uuid" || idStrategy === "serial") {
		return { generateId: idStrategy };
	}
	if (idStrategy === "number") return { useNumberId: true };
	return {};
}
