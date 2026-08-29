import type {
	FlowEvent,
	ProjectedMessage,
	ProjectTimelineOptions,
} from "../types";

/**
 * Projects a raw stream of `FlowEvent` records into a list of presentation
 * messages (`ProjectedMessage`), folding revisions (`message.edit`) and
 * deletions (`message.delete`) into their respective target messages.
 *
 * @param events The list of raw flow events to project (can be ascending or descending).
 * @param options Projection options, e.g. whether to include deleted messages.
 * @returns Array of projected messages ordered by initial creation sequence ID.
 */
export function projectTimeline(
	events: FlowEvent[],
	options: ProjectTimelineOptions = {},
): ProjectedMessage[] {
	const includeDeleted = options.includeDeleted ?? true;

	// Sort events oldest-first so revisions and tombstones apply in causal order.
	const chronologicalEvents = [...events].sort(
		(a, b) => a.sequenceId - b.sequenceId,
	);

	const messageMap = new Map<string, ProjectedMessage>();
	const orderedIds: string[] = [];

	for (const event of chronologicalEvents) {
		// Ignore state events in timeline message projection
		if (event.stateKey !== null) {
			continue;
		}

		if (event.type === "message.edit") {
			// Find target message from content.targetMessageId or parentEventIds
			const raw = event as unknown as {
				parentEventIds?: string[];
				parentEventId?: string;
			};
			const targetId =
				(typeof event.content.targetMessageId === "string"
					? event.content.targetMessageId
					: null) ??
				raw.parentEventIds?.[0] ??
				raw.parentEventId;

			if (targetId && messageMap.has(targetId)) {
				const projected = messageMap.get(targetId)!;
				const newBody =
					typeof event.content.body === "string"
						? event.content.body
						: projected.body;
				const editedAt =
					typeof event.content.editedAt === "number"
						? event.content.editedAt
						: event.timestamp;

				projected.body = newBody;
				projected.content = { ...projected.content, ...event.content };
				projected.isEdited = true;
				projected.editedAt = editedAt;
				projected.lastEditSequenceId = event.sequenceId;
				projected.editCount += 1;
				projected.rawEvents.push(event);
			}
			continue;
		}

		if (event.type === "message.delete") {
			const raw = event as unknown as {
				parentEventIds?: string[];
				parentEventId?: string;
			};
			const targetId =
				(typeof event.content.targetMessageId === "string"
					? event.content.targetMessageId
					: null) ??
				raw.parentEventIds?.[0] ??
				raw.parentEventId;

			if (targetId && messageMap.has(targetId)) {
				const projected = messageMap.get(targetId)!;
				const deletedAt =
					typeof event.content.deletedAt === "number"
						? event.content.deletedAt
						: event.timestamp;
				const reason =
					typeof event.content.reason === "string"
						? event.content.reason
						: null;

				projected.isDeleted = true;
				projected.body = "";
				projected.deletedAt = deletedAt;
				projected.deleteReason = reason;
				projected.rawEvents.push(event);
			}
			continue;
		}

		// Root message event (e.g. message.text or other conversation items)
		const body =
			typeof event.content.body === "string" ? event.content.body : "";

		const projected: ProjectedMessage = {
			id: event.id,
			roomId: event.roomId,
			senderId: event.senderId,
			type: event.type,
			body,
			content: { ...event.content },
			timestamp: event.timestamp,
			sequenceId: event.sequenceId,
			isEdited: false,
			editedAt: null,
			lastEditSequenceId: null,
			isDeleted: false,
			deletedAt: null,
			deleteReason: null,
			editCount: 0,
			rawEvents: [event],
		};

		messageMap.set(event.id, projected);
		orderedIds.push(event.id);
	}

	const result: ProjectedMessage[] = [];
	for (const id of orderedIds) {
		const msg = messageMap.get(id);
		if (msg && (includeDeleted || !msg.isDeleted)) {
			result.push(msg);
		}
	}

	return result;
}
