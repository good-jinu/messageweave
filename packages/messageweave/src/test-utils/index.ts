import type { MessageWeave } from "../messageweave";
import { createMessageWeave } from "../messageweave";

import type { MessageWeaveOptions } from "../options";
import type { MemoryDatabase } from "./memory-storage";
import { createMemoryStorage } from "./memory-storage";

export type { MemoryDatabase } from "./memory-storage";

/** The object returned by {@link getTestInstance}. */
export interface TestInstance {
	/** A MessageWeave engine backed by an in-memory store. */
	flow: MessageWeave;
	/** The raw in-memory tables, for direct assertions. */
	db: MemoryDatabase;
}

/**
 * Spin up a MessageWeave engine backed by the corrected in-memory adapter.
 * Mirrors the `getTestInstance()` ergonomics used elsewhere in the workspace.
 */
export function getTestInstance(
	options?: Partial<Omit<MessageWeaveOptions, "storage">>,
): TestInstance {
	const db: MemoryDatabase = {
		room: [],
		event: [],
		eventEdge: [],
		roomState: [],
		sequence: [],
	};
	const flow = createMessageWeave({
		storage: createMemoryStorage(db),
		...options,
	});
	return { flow, db };
}
