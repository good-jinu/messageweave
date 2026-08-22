import type { Kysely } from "kysely";
import type { Sumak } from "sumak";
import { drizzleStorage } from "./drizzle";
import { kyselyStorage } from "./kysely";
import { sumakStorage } from "./sumak";

interface ExampleDatabase {
	room: {
		id: string;
	};
}

interface ExampleDrizzleDatabase {
	select(): unknown;
}

declare const drizzle: ExampleDrizzleDatabase;
declare const kysely: Kysely<ExampleDatabase>;
declare const sumak: Sumak<ExampleDatabase>;

drizzleStorage(drizzle, { provider: "pg", schema: {} });
kyselyStorage(kysely, { type: "postgres" });
sumakStorage(sumak, { type: "postgres" });
