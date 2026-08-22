/** Primitive values supported in ChatCore storage filters. */
export type ChatCoreStorageValue =
	| string
	| number
	| boolean
	| string[]
	| number[]
	| Temporal.Instant
	| Temporal.PlainDate
	| Temporal.ZonedDateTime
	| null;

/** Query operators supported by ChatCore storage implementations. */
export type ChatCoreStorageOperator =
	| "eq"
	| "ne"
	| "lt"
	| "lte"
	| "gt"
	| "gte"
	| "in"
	| "contains"
	| "starts_with"
	| "ends_with";

/** A single storage-layer filter predicate. */
export interface ChatCoreStorageWhere {
	/** Logical field name to filter. */
	field: string;
	/** Value compared by the selected operator. */
	value: ChatCoreStorageValue;
	/** Comparison operator; defaults to equality. */
	operator?: ChatCoreStorageOperator;
	/** Predicate group; defaults to `AND`. */
	connector?: "AND" | "OR";
}

/** A raw storage row, before/after domain mapping. */
export type ChatCoreStorageRow = Record<string, unknown>;

/** Primary-key strategy shared by built-in MessageWeave storage adapters. */
export type MessageWeaveStorageIdStrategy =
	| "number"
	| "serial"
	| "string"
	| "uuid";

/** The narrow CRUD/query surface ChatCore needs from a storage backend. */
export interface ChatCoreStorage {
	/** Insert a row and return the stored representation. */
	create(args: {
		model: string;
		data: ChatCoreStorageRow;
	}): Promise<ChatCoreStorageRow>;
	/** Find the first row matching every supplied predicate. */
	findOne(args: {
		model: string;
		where: ChatCoreStorageWhere[];
	}): Promise<ChatCoreStorageRow | null>;
	/** Find rows with optional filtering, ordering, and pagination. */
	findMany(args: {
		model: string;
		where?: ChatCoreStorageWhere[];
		sortBy?: { field: string; direction: "asc" | "desc" };
		limit?: number;
		offset?: number;
	}): Promise<ChatCoreStorageRow[]>;
	/** Update matching rows and return one updated representation when available. */
	update(args: {
		model: string;
		where: ChatCoreStorageWhere[];
		update: ChatCoreStorageRow;
	}): Promise<ChatCoreStorageRow | null>;
	/** Count rows matching the optional predicates. */
	count(args: {
		model: string;
		where?: ChatCoreStorageWhere[];
	}): Promise<number>;
}
