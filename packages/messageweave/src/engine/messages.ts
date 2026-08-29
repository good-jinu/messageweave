import type {
	DeleteMessageInput,
	EditMessageInput,
	PublishEventInput,
	PublishEventResult,
	SendMessageInput,
} from "../types";
import {
	parseDeleteMessageInput,
	parseEditMessageInput,
	parseSendMessageInput,
} from "../utils/validate";

/** Convenience methods for common chat message operations. */
export function createMessageMethods(
	publishEvent: (input: PublishEventInput) => Promise<PublishEventResult>,
) {
	/** Publish a plain-text message to a room. */
	async function sendMessage(
		input: SendMessageInput,
	): Promise<PublishEventResult> {
		const data = parseSendMessageInput(input);
		return publishEvent({
			roomId: data.roomId,
			senderId: data.senderId,
			type: "message.text",
			content: { body: data.body },
			parentEventIds: data.parentEventIds,
		});
	}

	/** Publish an edit revision for an existing message. */
	async function editMessage(
		input: EditMessageInput,
	): Promise<PublishEventResult> {
		const data = parseEditMessageInput(input);
		return publishEvent({
			roomId: data.roomId,
			senderId: data.senderId,
			type: "message.edit",
			content: {
				targetMessageId: data.messageId,
				body: data.body,
				editedAt: Date.now(),
				...(data.content ?? {}),
			},
			parentEventIds: [data.messageId],
		});
	}

	/** Publish a tombstone event marking an existing message as deleted. */
	async function deleteMessage(
		input: DeleteMessageInput,
	): Promise<PublishEventResult> {
		const data = parseDeleteMessageInput(input);
		return publishEvent({
			roomId: data.roomId,
			senderId: data.senderId,
			type: "message.delete",
			content: {
				targetMessageId: data.messageId,
				tombstone: true,
				deletedAt: Date.now(),
				...(data.reason !== undefined ? { reason: data.reason } : {}),
				...(data.content ?? {}),
			},
			parentEventIds: [data.messageId],
		});
	}

	return { sendMessage, editMessage, deleteMessage };
}
