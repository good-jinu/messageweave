import { defineConfig } from "tsdown";

export default defineConfig({
	dts: { build: true, incremental: true },
	format: ["esm"],
	entry: [
		"./src/index.ts",
		"./src/test-utils/index.ts",
		"./src/schema.ts",
		"./src/adapters/drizzle.ts",
		"./src/adapters/prisma.ts",
		"./src/adapters/kysely.ts",
		"./src/adapters/knex.ts",
		"./src/adapters/mongodb.ts",
		"./src/adapters/sumak.ts",
	],
});
