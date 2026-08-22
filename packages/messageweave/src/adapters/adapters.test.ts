import { describe, expect, it } from "vitest";
import { drizzleStorage } from "./drizzle";
import { prismaStorage } from "./prisma";

describe("built-in database storage entry points", () => {
	it("creates Drizzle storage without exposing Unadapter configuration", () => {
		const storage = drizzleStorage(
			{},
			{ provider: "pg", schema: {}, idStrategy: "uuid" },
		);

		expect(storage).toMatchObject({
			create: expect.any(Function),
			findOne: expect.any(Function),
			findMany: expect.any(Function),
			update: expect.any(Function),
			count: expect.any(Function),
		});
	});

	it("creates Prisma storage without exposing Unadapter configuration", () => {
		const storage = prismaStorage({}, { provider: "postgresql" });

		expect(storage).toMatchObject({
			create: expect.any(Function),
			findOne: expect.any(Function),
			findMany: expect.any(Function),
			update: expect.any(Function),
			count: expect.any(Function),
		});
	});
});
