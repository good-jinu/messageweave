import type {
	DrizzleDialect as UnadapterDrizzleDialect,
	PrismaProvider as UnadapterPrismaProvider,
} from "unadapter/generate";
import { generate } from "unadapter/generate";
import { getMessageWeaveTables } from "./schema";

export type MessageWeaveDrizzleDialect = UnadapterDrizzleDialect;
export type MessageWeavePrismaProvider = UnadapterPrismaProvider;
export type MessageWeaveSchemaIdStrategy =
	| "number"
	| "serial"
	| "string"
	| "uuid";

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

export type GenerateMessageWeaveSchemaOptions =
	| ({ format: "drizzle" } & GenerateDrizzleSchemaOptions)
	| ({ format: "prisma" } & GeneratePrismaSchemaOptions);

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
