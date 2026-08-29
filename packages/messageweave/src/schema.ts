/** Field types used by MessageWeave's framework-neutral storage schema. */
export type MessageWeaveSchemaFieldType =
	| "boolean"
	| "json"
	| "number"
	| "string";

/** A reference from one MessageWeave storage field to another table. */
export interface MessageWeaveSchemaReference {
	/** Logical model name of the referenced table. */
	model: string;
	/** Field name in the referenced table. */
	field: string;
	/** Referential action applied when the target row is deleted. */
	onDelete?: "cascade" | "no action" | "restrict" | "set default" | "set null";
}

/** Description of one field in MessageWeave's storage schema. */
export interface MessageWeaveSchemaField {
	/** Logical value type stored in this field. */
	type: MessageWeaveSchemaFieldType;
	/** Whether inserts must supply a non-null value. */
	required?: boolean;
	/** Whether the database must enforce uniqueness. */
	unique?: boolean;
	/** Whether a numeric field requires a database bigint representation. */
	bigint?: boolean;
	/** Optional foreign-key relationship. */
	references?: MessageWeaveSchemaReference;
}

/** Description of one table in MessageWeave's storage schema. */
export interface MessageWeaveSchemaTable {
	/** Physical table or collection name. */
	modelName: string;
	/** Creation order used when generating relational schemas. */
	order?: number;
	/** Logical fields keyed by their MessageWeave names. */
	fields: Record<string, MessageWeaveSchemaField>;
}

/** Framework-neutral description of all tables required by MessageWeave. */
export type MessageWeaveSchema = Record<string, MessageWeaveSchemaTable>;

/** The canonical storage schema required by MessageWeave. */
export const messageWeaveTables: MessageWeaveSchema = {
	room: {
		modelName: "room",
		order: 1,
		fields: {
			creatorId: { type: "string", required: true },
			createdAt: { type: "number", required: true, bigint: true },
			metadata: { type: "json", required: true },
		},
	},
	event: {
		modelName: "event",
		order: 2,
		fields: {
			roomId: {
				type: "string",
				required: true,
				references: { model: "room", field: "id", onDelete: "cascade" },
			},
			senderId: { type: "string", required: true },
			type: { type: "string", required: true },
			stateKey: { type: "string", required: false },
			content: { type: "json", required: true },
			timestamp: { type: "number", required: true, bigint: true },
			sequenceId: {
				type: "number",
				required: true,
				bigint: true,
				unique: true,
			},
		},
	},
	eventEdge: {
		modelName: "eventEdge",
		order: 3,
		fields: {
			eventId: {
				type: "string",
				required: true,
				references: { model: "event", field: "id", onDelete: "cascade" },
			},
			parentEventId: { type: "string", required: true },
		},
	},
	roomState: {
		modelName: "roomState",
		order: 4,
		fields: {
			roomId: {
				type: "string",
				required: true,
				references: { model: "room", field: "id", onDelete: "cascade" },
			},
			eventType: { type: "string", required: true },
			stateKey: { type: "string", required: true },
			eventId: {
				type: "string",
				required: true,
				references: { model: "event", field: "id", onDelete: "cascade" },
			},
		},
	},
	sequence: {
		modelName: "sequence",
		order: 5,
		fields: {
			name: { type: "string", required: true, unique: true },
			value: { type: "number", required: true, bigint: true },
		},
	},
} satisfies MessageWeaveSchema;

/** Return MessageWeave's canonical framework-neutral storage schema. */
export function getMessageWeaveTables(): MessageWeaveSchema {
	const tables: MessageWeaveSchema = {};

	for (const [tableName, table] of Object.entries(messageWeaveTables)) {
		const fields: Record<string, MessageWeaveSchemaField> = {};
		for (const [fieldName, field] of Object.entries(table.fields)) {
			fields[fieldName] = {
				...field,
				references: field.references ? { ...field.references } : undefined,
			};
		}
		tables[tableName] = { ...table, fields };
	}

	return tables;
}

export {
	type GenerateDrizzleSchemaOptions,
	type GenerateMessageWeaveDrizzleSchemaOptions,
	type GenerateMessageWeavePrismaSchemaOptions,
	type GenerateMessageWeaveSchemaOptions,
	type GeneratePrismaSchemaOptions,
	generateDrizzleSchema,
	generateMessageWeaveSchema,
	generatePrismaSchema,
	type MessageWeaveDrizzleDialect,
	type MessageWeavePrismaProvider,
	type MessageWeaveSchemaIdStrategy,
} from "./generate";
