import type { FlowAdapter } from "../db/adapter";
import { toEvent } from "../db/rows";
import type { FlowEvent } from "../types";

interface UpsertStateArgs {
	roomId: string;
	eventType: string;
	stateKey: string;
	eventId: string;
}

/**
 * Upsert the projected room-state cache under the composite key
 * `[roomId, eventType, stateKey]`, pointing it at the newest state event.
 */
export async function upsertRoomState(
	adapter: FlowAdapter,
	{ roomId, eventType, stateKey, eventId }: UpsertStateArgs,
): Promise<void> {
	const existing = await adapter.findOne({
		model: "roomState",
		where: [
			{ field: "roomId", value: roomId },
			{ field: "eventType", value: eventType },
			{ field: "stateKey", value: stateKey },
		],
	});

	if (existing) {
		await adapter.update({
			model: "roomState",
			where: [
				{ field: "roomId", value: roomId },
				{ field: "eventType", value: eventType },
				{ field: "stateKey", value: stateKey },
			],
			update: { eventId },
		});
		return;
	}

	await adapter.create({
		model: "roomState",
		data: { roomId, eventType, stateKey, eventId },
	});
}

/** Read methods over the projected room state. */
export function createStateMethods(adapter: FlowAdapter) {
	/**
	 * Return the active state events for a room (the latest event per
	 * `[type, stateKey]`), resolved from the projection cache.
	 */
	async function getRoomState(roomId: string): Promise<FlowEvent[]> {
		const stateRows = await adapter.findMany({
			model: "roomState",
			where: [{ field: "roomId", value: roomId }],
		});

		if (stateRows.length === 0) {
			return [];
		}

		const eventIds = stateRows.map((state) => String(state.eventId));
		const eventRows = await adapter.findMany({
			model: "event",
			where: [{ field: "id", value: eventIds, operator: "in" }],
		});

		return eventRows.map(toEvent);
	}

	return { getRoomState };
}
