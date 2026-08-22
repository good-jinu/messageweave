import { createAdapter } from "unadapter";
import type { AdapterOptions } from "unadapter/types";
import { getMessageWeaveTables } from "../schema";
import type {
	ChatCoreStorage,
	ChatCoreStorageRow,
	ChatCoreStorageWhere,
	MessageWeaveStorageIdStrategy,
} from "../storage";

type MessageWeaveAdapterOptions = AdapterOptions<Record<string, unknown>>;

interface UnadapterStorage {
	create(args: {
		model: string;
		data: ChatCoreStorageRow;
	}): Promise<ChatCoreStorageRow>;
	findOne(args: {
		model: string;
		where: ChatCoreStorageWhere[];
	}): Promise<ChatCoreStorageRow | null>;
	findMany(args: {
		model: string;
		where?: ChatCoreStorageWhere[];
		sortBy?: { field: string; direction: "asc" | "desc" };
		limit?: number;
		offset?: number;
	}): Promise<ChatCoreStorageRow[]>;
	update(args: {
		model: string;
		where: ChatCoreStorageWhere[];
		update: ChatCoreStorageRow;
	}): Promise<ChatCoreStorageRow | null>;
	count(args: {
		model: string;
		where?: ChatCoreStorageWhere[];
	}): Promise<number>;
}

/**
 * Build MessageWeave storage from an Unadapter database factory.
 *
 * This is kept internal so Unadapter remains an implementation detail of the
 * public database-specific entry points.
 */
export function createUnadapterStorage(
	database: MessageWeaveAdapterOptions["database"],
	idStrategy: MessageWeaveStorageIdStrategy = "string",
): ChatCoreStorage {
	const adapter = createAdapter(getMessageWeaveTables, {
		database,
		advanced: {
			database:
				idStrategy === "number"
					? { useNumberId: true }
					: idStrategy === "serial" || idStrategy === "uuid"
						? { generateId: idStrategy }
						: {},
		},
	});
	const storage = adapter as unknown as UnadapterStorage;

	return {
		create: (args) => storage.create(args),
		findOne: (args) => storage.findOne(args),
		findMany: (args) => storage.findMany(args),
		update: (args) => storage.update(args),
		count: (args) => storage.count(args),
	};
}
