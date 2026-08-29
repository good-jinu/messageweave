import { describe, expect, it } from "vitest";
import {
	generateDrizzleSchema,
	generateMessageWeaveSchema,
	generatePrismaSchema,
} from "./generate";

describe("generateDrizzleSchema", () => {
	it("generates SQLite schema for Drizzle", async () => {
		const sql = await generateDrizzleSchema({ dialect: "sqlite" });
		expect(sql).toContain('sqliteTable("room"');
		expect(sql).toContain('sqliteTable("event"');
		expect(sql).toContain('sqliteTable("eventEdge"');
		expect(sql).toContain('sqliteTable("roomState"');
		expect(sql).toContain('sqliteTable("sequence"');
		expect(sql).toContain('references(() => room.id, { onDelete: "cascade" })');
	});

	it("generates PostgreSQL schema for Drizzle", async () => {
		const sql = await generateDrizzleSchema({ dialect: "postgres" });
		expect(sql).toContain('pgTable("room"');
		expect(sql).toContain('pgTable("event"');
		expect(sql).toContain('references(() => room.id, { onDelete: "cascade" })');
	});

	it("generates MySQL schema for Drizzle with number id strategy", async () => {
		const sql = await generateDrizzleSchema({
			dialect: "mysql",
			idStrategy: "number",
		});
		expect(sql).toContain('mysqlTable("room"');
		expect(sql).toContain('int("id").autoincrement().primaryKey()');
	});
});

describe("generatePrismaSchema", () => {
	it("generates Prisma models for PostgreSQL by default", async () => {
		const prisma = await generatePrismaSchema();
		expect(prisma).toContain("model Room {");
		expect(prisma).toContain("model Event {");
		expect(prisma).toContain("model EventEdge {");
		expect(prisma).toContain("model RoomState {");
		expect(prisma).toContain("model Sequence {");
		expect(prisma).toContain(
			"room       Room        @relation(fields: [roomId], references: [id], onDelete: Cascade)",
		);
		expect(prisma).toContain('@@map("room")');
	});

	it("supports includeDatasource option", async () => {
		const prisma = await generatePrismaSchema({
			provider: "postgresql",
			includeDatasource: true,
		});
		expect(prisma).toContain("datasource db {");
		expect(prisma).toContain('provider = "postgresql"');
		expect(prisma).toContain("generator client {");
		expect(prisma).toContain("model Room {");
	});

	it("supports custom id strategy like uuid", async () => {
		const prisma = await generatePrismaSchema({
			provider: "sqlite",
			idStrategy: "uuid",
		});
		expect(prisma).toContain("id         String      @id @default(uuid())");
	});
});

describe("generateMessageWeaveSchema", () => {
	it("dispatches to drizzle generator", async () => {
		const result = await generateMessageWeaveSchema({
			format: "drizzle",
			dialect: "sqlite",
		});
		expect(result).toContain('sqliteTable("room"');
	});

	it("dispatches to prisma generator", async () => {
		const result = await generateMessageWeaveSchema({
			format: "prisma",
			provider: "postgresql",
		});
		expect(result).toContain("model Room {");
	});
});
