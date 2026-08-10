import type { PublishEventResult, SendMessageInput } from "../types";
import { parseSendMessageInput } from "../utils/validate";

/** Convenience methods for common chat message operations. */
export function createMessageMethods(
	publishEvent: (input: {
		roomId: string;
		senderId: string;
		type: string;
		content: { body: string };
		parentEventIds?: string[];
	}) => Promise<PublishEventResult>,
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

	return { sendMessage };
}
