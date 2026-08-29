import type { Kysely } from "kysely";
import type { Sumak } from "sumak";
import { drizzleAdapter } from "./drizzle";
import { kyselyAdapter } from "./kysely";
import { sumakAdapter } from "./sumak";

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

drizzleAdapter(drizzle, { provider: "pg", schema: {} });
kyselyAdapter(kysely, { type: "postgres" });
sumakAdapter(sumak, { type: "postgres" });
