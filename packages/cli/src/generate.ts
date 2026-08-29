import { Kysely, MysqlDialect, PostgresDialect, SqliteDialect } from "kysely";
import type {
	GenerateDrizzleSchemaOptions,
	GeneratePrismaSchemaOptions,
	MessageWeaveDrizzleDialect,
	MessageWeavePrismaProvider,
	MessageWeaveSchemaIdStrategy,
} from "messageweave/schema";
import {
	generateDrizzleSchema,
	generatePrismaSchema,
} from "messageweave/schema";
import { generate } from "unadapter/generate";
import { kyselyAdapter } from "unadapter/kysely";
import { getMessageWeaveTables } from "./schema";

export type ChatCoreSchemaFormat = "drizzle" | "prisma" | "sql";

export type ChatCoreSchemaDialect =
	| MessageWeaveDrizzleDialect
	| "mysql"
	| "postgres"
	| "sqlite";

export type ChatCoreSchemaProvider = MessageWeavePrismaProvider;

export type ChatCoreSchemaIdStrategy = MessageWeaveSchemaIdStrategy;

export interface GenerateChatCoreSqlSchemaOptions {
	format?: "sql";
	dialect: ChatCoreSchemaDialect;
	/**
	 * Primary-key strategy for the generated `id` columns.
	 *
	 * @default "string"
	 */
	idStrategy?: ChatCoreSchemaIdStrategy;
}

export interface GenerateChatCoreDrizzleSchemaOptions {
	format: "drizzle";
	dialect: ChatCoreSchemaDialect;
	/**
	 * Primary-key strategy for the generated `id` columns.
	 *
	 * @default "string"
	 */
	idStrategy?: ChatCoreSchemaIdStrategy;
}

export interface GenerateChatCorePrismaSchemaOptions {
	format: "prisma";
	/**
	 * Target database provider for Prisma.
	 *
	 * @default "postgresql"
	 */
	provider?: ChatCoreSchemaProvider;
	/**
	 * Alias for `provider`.
	 */
	dialect?: ChatCoreSchemaProvider;
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
	idStrategy?: ChatCoreSchemaIdStrategy;
}

export type GenerateChatCoreSchemaOptions =
	| GenerateChatCoreSqlSchemaOptions
	| GenerateChatCoreDrizzleSchemaOptions
	| GenerateChatCorePrismaSchemaOptions;

export type GenerateMessageWeaveSchemaOptions = GenerateChatCoreSchemaOptions;

type EmptyDatabase = Record<string, never>;

interface AdvancedDatabaseOptions {
	generateId?: "serial" | "uuid";
	useNumberId?: true;
}

/** Generate schema definition (SQL, Drizzle, or Prisma) for ChatCore's storage tables. */
export async function generateChatCoreSchema(
	options: GenerateChatCoreSchemaOptions,
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
	return applyChatCoreForeignKeyCascades(sql, options.dialect);
}

export const generateMessageWeaveSchema = generateChatCoreSchema;

export {
	type GenerateDrizzleSchemaOptions,
	type GeneratePrismaSchemaOptions,
	generateDrizzleSchema,
	generatePrismaSchema,
};

function createDriverlessKysely(
	dialect: ChatCoreSchemaDialect,
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
	idStrategy: ChatCoreSchemaIdStrategy,
): AdvancedDatabaseOptions {
	if (idStrategy === "uuid" || idStrategy === "serial") {
		return { generateId: idStrategy };
	}
	if (idStrategy === "number") return { useNumberId: true };
	return {};
}

function applyChatCoreForeignKeyCascades(
	sql: string,
	dialect: ChatCoreSchemaDialect,
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
