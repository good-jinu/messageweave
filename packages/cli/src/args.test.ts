import { describe, expect, it } from "vitest";
import { parseCliArgs } from "./args";

describe("parseCliArgs", () => {
	it("parses schema generation options for SQL (default format)", () => {
		expect(
			parseCliArgs([
				"schema",
				"generate",
				"--dialect",
				"sqlite",
				"--out=./schema.sql",
				"--id-strategy",
				"string",
			]),
		).toEqual({
			ok: true,
			command: {
				type: "schema-generate",
				options: {
					format: "sql",
					dialect: "sqlite",
					idStrategy: "string",
					out: "./schema.sql",
				},
			},
		});
	});

	it("parses schema generation options for Drizzle", () => {
		expect(
			parseCliArgs([
				"schema",
				"generate",
				"--format",
				"drizzle",
				"--dialect",
				"postgres",
				"--out",
				"./src/db/schema.ts",
			]),
		).toEqual({
			ok: true,
			command: {
				type: "schema-generate",
				options: {
					format: "drizzle",
					dialect: "postgres",
					idStrategy: undefined,
					out: "./src/db/schema.ts",
				},
			},
		});
	});

	it("parses schema generation options for Prisma", () => {
		expect(
			parseCliArgs([
				"schema",
				"generate",
				"--format",
				"prisma",
				"--provider",
				"postgresql",
				"--include-datasource",
				"--out",
				"./prisma/schema.prisma",
			]),
		).toEqual({
			ok: true,
			command: {
				type: "schema-generate",
				options: {
					format: "prisma",
					provider: "postgresql",
					includeDatasource: true,
					idStrategy: undefined,
					out: "./prisma/schema.prisma",
				},
			},
		});
	});

	it("parses schema generation for Prisma defaulting to postgresql when provider omitted", () => {
		expect(parseCliArgs(["schema", "generate", "--format", "prisma"])).toEqual({
			ok: true,
			command: {
				type: "schema-generate",
				options: {
					format: "prisma",
					provider: "postgresql",
					includeDatasource: undefined,
					idStrategy: undefined,
					out: undefined,
				},
			},
		});
	});

	it("requires an explicit dialect for SQL and Drizzle", () => {
		expect(parseCliArgs(["schema", "generate"])).toEqual({
			ok: false,
			message: "Missing required option: --dialect <mysql|postgres|sqlite>",
		});
		expect(parseCliArgs(["schema", "generate", "--format", "drizzle"])).toEqual(
			{
				ok: false,
				message: "Missing required option: --dialect <mysql|postgres|sqlite>",
			},
		);
	});

	it("rejects unknown commands", () => {
		expect(parseCliArgs(["generate"])).toEqual({
			ok: false,
			message: "Unknown command: generate",
		});
	});

	it("rejects invalid format", () => {
		expect(parseCliArgs(["schema", "generate", "--format", "unknown"])).toEqual(
			{
				ok: false,
				message:
					"Invalid --format value: unknown. Expected: sql, drizzle, prisma",
			},
		);
	});
});
