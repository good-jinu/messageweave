/** Primitive values supported in MessageWeave storage filters. */
export type MessageWeaveStorageValue =
	| string
	| number
	| boolean
	| string[]
	| number[]
	| Temporal.Instant
	| Temporal.PlainDate
	| Temporal.ZonedDateTime
	| null;

/** Backwards-compatible alias for {@link MessageWeaveStorageValue}. */
export type ChatCoreStorageValue = MessageWeaveStorageValue;

/** Query operators supported by MessageWeave storage implementations. */
export type MessageWeaveStorageOperator =
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

/** Backwards-compatible alias for {@link MessageWeaveStorageOperator}. */
export type ChatCoreStorageOperator = MessageWeaveStorageOperator;

/** A single storage-layer filter predicate. */
export interface MessageWeaveStorageWhere {
	/** Logical field name to filter. */
	field: string;
	/** Value compared by the selected operator. */
	value: MessageWeaveStorageValue;
	/** Comparison operator; defaults to equality. */
	operator?: MessageWeaveStorageOperator;
	/** Predicate group; defaults to `AND`. */
	connector?: "AND" | "OR";
}

/** Backwards-compatible alias for {@link MessageWeaveStorageWhere}. */
export type ChatCoreStorageWhere = MessageWeaveStorageWhere;

/** A raw storage row, before/after domain mapping. */
export type MessageWeaveStorageRow = Record<string, unknown>;

/** Backwards-compatible alias for {@link MessageWeaveStorageRow}. */
export type ChatCoreStorageRow = MessageWeaveStorageRow;

/** Primary-key strategy shared by built-in MessageWeave storage adapters. */
export type MessageWeaveStorageIdStrategy =
	| "number"
	| "serial"
	| "string"
	| "uuid";

/** The narrow CRUD/query surface MessageWeave needs from a storage backend. */
export interface MessageWeaveStorage {
	/** Insert a row and return the stored representation. */
	create(args: {
		model: string;
		data: MessageWeaveStorageRow;
	}): Promise<MessageWeaveStorageRow>;
	/** Find the first row matching every supplied predicate. */
	findOne(args: {
		model: string;
		where: MessageWeaveStorageWhere[];
	}): Promise<MessageWeaveStorageRow | null>;
	/** Find rows with optional filtering, ordering, and pagination. */
	findMany(args: {
		model: string;
		where?: MessageWeaveStorageWhere[];
		sortBy?: { field: string; direction: "asc" | "desc" };
		limit?: number;
		offset?: number;
	}): Promise<MessageWeaveStorageRow[]>;
	/** Update matching rows and return one updated representation when available. */
	update(args: {
		model: string;
		where: MessageWeaveStorageWhere[];
		update: MessageWeaveStorageRow;
	}): Promise<MessageWeaveStorageRow | null>;
	/** Count rows matching the optional predicates. */
	count(args: {
		model: string;
		where?: MessageWeaveStorageWhere[];
	}): Promise<number>;
}

/** Backwards-compatible alias for {@link MessageWeaveStorage}. */
export type ChatCoreStorage = MessageWeaveStorage;
