import { describe, expect, it } from "vitest";
import { drizzleAdapter } from "./drizzle";
import { prismaAdapter } from "./prisma";

describe("built-in database storage entry points", () => {
	it("creates Drizzle storage without exposing Unadapter configuration", () => {
		const storage = drizzleAdapter(
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
		const storage = prismaAdapter({}, { provider: "postgresql" });

		expect(storage).toMatchObject({
			create: expect.any(Function),
			findOne: expect.any(Function),
			findMany: expect.any(Function),
			update: expect.any(Function),
			count: expect.any(Function),
		});
	});
});
