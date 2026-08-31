import { Kysely, MysqlDialect, PostgresDialect, SqliteDialect } from "kysely";
import type {
	MessageWeaveSchemaIdStrategy as CoreMessageWeaveSchemaIdStrategy,
	GenerateDrizzleSchemaOptions,
	GeneratePrismaSchemaOptions,
	MessageWeaveDrizzleDialect,
	MessageWeavePrismaProvider,
} from "messageweave/schema";
import {
	generateDrizzleSchema,
	generatePrismaSchema,
} from "messageweave/schema";
import { generate } from "unadapter/generate";
import { kyselyAdapter } from "unadapter/kysely";
import { getMessageWeaveTables } from "./schema";

export type MessageWeaveSchemaFormat = "drizzle" | "prisma" | "sql";

export type MessageWeaveSchemaDialect =
	| MessageWeaveDrizzleDialect
	| "mysql"
	| "postgres"
	| "sqlite";

export type MessageWeaveSchemaProvider = MessageWeavePrismaProvider;
export type MessageWeaveSchemaIdStrategy = CoreMessageWeaveSchemaIdStrategy;
export type { MessageWeavePrismaProvider };

export interface GenerateMessageWeaveSqlSchemaOptions {
	format?: "sql";
	dialect: MessageWeaveSchemaDialect;
	/**
	 * Primary-key strategy for the generated `id` columns.
	 *
	 * @default "string"
	 */
	idStrategy?: MessageWeaveSchemaIdStrategy;
}

export interface GenerateMessageWeaveDrizzleSchemaOptions {
	format: "drizzle";
	dialect: MessageWeaveSchemaDialect;
	/**
	 * Primary-key strategy for the generated `id` columns.
	 *
	 * @default "string"
	 */
	idStrategy?: MessageWeaveSchemaIdStrategy;
}

export interface GenerateMessageWeavePrismaSchemaOptions {
	format: "prisma";
	/**
	 * Target database provider for Prisma.
	 *
	 * @default "postgresql"
	 */
	provider?: MessageWeaveSchemaProvider;
	/**
	 * Alias for `provider`.
	 */
	dialect?: MessageWeaveSchemaProvider;
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
	| GenerateMessageWeaveSqlSchemaOptions
	| GenerateMessageWeaveDrizzleSchemaOptions
	| GenerateMessageWeavePrismaSchemaOptions;

export type ChatCoreSchemaFormat = MessageWeaveSchemaFormat;
export type ChatCoreSchemaDialect = MessageWeaveSchemaDialect;
export type ChatCoreSchemaProvider = MessageWeaveSchemaProvider;
export type ChatCoreSchemaIdStrategy = MessageWeaveSchemaIdStrategy;
export type GenerateChatCoreSqlSchemaOptions =
	GenerateMessageWeaveSqlSchemaOptions;
export type GenerateChatCoreDrizzleSchemaOptions =
	GenerateMessageWeaveDrizzleSchemaOptions;
export type GenerateChatCorePrismaSchemaOptions =
	GenerateMessageWeavePrismaSchemaOptions;
export type GenerateChatCoreSchemaOptions = GenerateMessageWeaveSchemaOptions;

type EmptyDatabase = Record<string, never>;

interface AdvancedDatabaseOptions {
	generateId?: "serial" | "uuid";
	useNumberId?: true;
}

/** Generate schema definition (SQL, Drizzle, or Prisma) for MessageWeave's storage tables. */
export async function generateMessageWeaveSchema(
	options: GenerateMessageWeaveSchemaOptions,
): Promise<string> {
	if (options.format === "drizzle") {
		return generateDrizzleSchema(options);
	}

	if (options.format === "prisma") {
		return generatePrismaSchema(options);
	}

	const db = createDriverlessKysely(options.dialect);
	const adapter = kyselyAdapter(db, { type: options.dialect });
	const sql = await generate(
		getMessageWeaveTables,
		{
			database: adapter,
			advanced: {
				database: toAdvancedDatabaseOptions(options.idStrategy ?? "string"),
			},
		},
		{ format: "sql" },
	);
	return applyMessageWeaveForeignKeyCascades(sql, options.dialect);
}

/** Backwards-compatible alias for {@link generateMessageWeaveSchema}. */
export const generateChatCoreSchema = generateMessageWeaveSchema;

export {
	type GenerateDrizzleSchemaOptions,
	type GeneratePrismaSchemaOptions,
	generateDrizzleSchema,
	generatePrismaSchema,
};

function createDriverlessKysely(
	dialect: MessageWeaveSchemaDialect,
): Kysely<EmptyDatabase> {
	if (dialect === "postgres") {
		return new Kysely<EmptyDatabase>({
			dialect: new PostgresDialect({
				pool: {},
			} as ConstructorParameters<typeof PostgresDialect>[0]),
		});
	}

	if (dialect === "mysql") {
		return new Kysely<EmptyDatabase>({
			dialect: new MysqlDialect({
				pool: {},
			} as ConstructorParameters<typeof MysqlDialect>[0]),
		});
	}

	return new Kysely<EmptyDatabase>({
		dialect: new SqliteDialect({
			database: {},
		} as ConstructorParameters<typeof SqliteDialect>[0]),
	});
}

function toAdvancedDatabaseOptions(
	idStrategy: MessageWeaveSchemaIdStrategy,
): AdvancedDatabaseOptions {
	if (idStrategy === "uuid" || idStrategy === "serial") {
		return { generateId: idStrategy };
	}
	if (idStrategy === "number") return { useNumberId: true };
	return {};
}

function applyMessageWeaveForeignKeyCascades(
	sql: string,
	dialect: MessageWeaveSchemaDialect,
): string {
	const quotedReferences =
		dialect === "mysql"
			? [
					/references `room` \(`id`\)(?! on delete)/g,
					/references `event` \(`id`\)(?! on delete)/g,
				]
			: [
					/references "room" \("id"\)(?! on delete)/g,
					/references "event" \("id"\)(?! on delete)/g,
				];

	return quotedReferences.reduce(
		(current, referencePattern) =>
			current.replace(referencePattern, (reference) => {
				return `${reference} on delete cascade`;
			}),
		sql,
	);
}

export const applyChatCoreForeignKeyCascades =
	applyMessageWeaveForeignKeyCascades;
