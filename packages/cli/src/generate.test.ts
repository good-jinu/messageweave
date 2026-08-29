import { describe, expect, it } from "vitest";
import { generateChatCoreSchema, generateMessageWeaveSchema } from "./generate";

describe("generateChatCoreSchema", () => {
	it("generates SQLite DDL for ChatCore tables", async () => {
		const sql = await generateChatCoreSchema({ dialect: "sqlite" });

		expect(sql).toContain('create table "room"');
		expect(sql).toContain('create table "event"');
		expect(sql).toContain(
			'"roomId" text not null references "room" ("id") on delete cascade',
		);
		expect(sql).toContain('"sequenceId" bigint not null unique');
	});

	it("uses native JSON columns for Postgres", async () => {
		const sql = await generateChatCoreSchema({ dialect: "postgres" });

		expect(sql).toContain('"metadata" jsonb not null');
		expect(sql).toContain('"content" jsonb not null');
	});

	it("generates Drizzle schemas", async () => {
		const code = await generateChatCoreSchema({
			format: "drizzle",
			dialect: "postgres",
		});

		expect(code).toContain('pgTable("room"');
		expect(code).toContain('pgTable("event"');
		expect(code).toContain(
			'references(() => room.id, { onDelete: "cascade" })',
		);
	});

	it("generates Prisma schemas", async () => {
		const schema = await generateChatCoreSchema({
			format: "prisma",
			provider: "postgresql",
			includeDatasource: true,
		});

		expect(schema).toContain("datasource db {");
		expect(schema).toContain('provider = "postgresql"');
		expect(schema).toContain("model Room {");
		expect(schema).toContain("model Event {");
		expect(schema).toContain(
			"room       Room        @relation(fields: [roomId], references: [id], onDelete: Cascade)",
		);
	});

	it("works via generateMessageWeaveSchema alias", async () => {
		const ddl = await generateMessageWeaveSchema({ dialect: "sqlite" });
		expect(ddl).toContain('create table "room"');
	});
});
