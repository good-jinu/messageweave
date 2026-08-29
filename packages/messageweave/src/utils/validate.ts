import * as z from "zod";
import type { JsonObject, JsonValue } from "../types";

/** Thrown when an SDK method receives invalid input. */
export interface ChatCoreError extends Error {
	/** Stable error name for runtime narrowing. */
	name: "ChatCoreError";
}

interface ChatCoreErrorConstructor {
	new (message: string): ChatCoreError;
	(message: string): ChatCoreError;
	prototype: ChatCoreError;
}

function ChatCoreErrorImpl(
	this: ChatCoreError | undefined,
	message: string,
): ChatCoreError {
	const error = new Error(message) as ChatCoreError;
	error.name = "ChatCoreError";
	Object.setPrototypeOf(error, ChatCoreErrorImpl.prototype);
	return error;
}

ChatCoreErrorImpl.prototype = Object.create(Error.prototype) as ChatCoreError;
Object.defineProperty(ChatCoreErrorImpl.prototype, "constructor", {
	value: ChatCoreErrorImpl,
	writable: true,
	configurable: true,
});

/** Error constructor used for invalid MessageWeave inputs and operations. */
export const ChatCoreError = ChatCoreErrorImpl as ChatCoreErrorConstructor;

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
	z.union([
		z.string(),
		z.number().finite(),
		z.boolean(),
		z.null(),
		z.array(jsonValueSchema),
		z.record(z.string(), jsonValueSchema),
	]),
);

const jsonObjectSchema: z.ZodType<JsonObject> = z.record(
	z.string(),
	jsonValueSchema,
);

const createRoomSchema = z.object({
	creatorId: z.string().min(1, "creatorId is required"),
	metadata: jsonObjectSchema.optional(),
});

const publishEventSchema = z.object({
	roomId: z.string().min(1, "roomId is required"),
	senderId: z.string().min(1, "senderId is required"),
	type: z.string().min(1, "type is required"),
	stateKey: z.string().optional(),
	content: jsonObjectSchema.optional(),
	parentEventIds: z.array(z.string().min(1)).optional(),
});

const sendMessageSchema = z.object({
	roomId: z.string().min(1, "roomId is required"),
	senderId: z.string().min(1, "senderId is required"),
	body: z
		.string()
		.refine((value) => value.trim().length > 0, "body is required"),
	parentEventIds: z.array(z.string().min(1)).optional(),
});

const editMessageSchema = z.object({
	roomId: z.string().min(1, "roomId is required"),
	senderId: z.string().min(1, "senderId is required"),
	messageId: z.string().min(1, "messageId is required"),
	body: z
		.string()
		.refine((value) => value.trim().length > 0, "body is required"),
	content: jsonObjectSchema.optional(),
});

const deleteMessageSchema = z.object({
	roomId: z.string().min(1, "roomId is required"),
	senderId: z.string().min(1, "senderId is required"),
	messageId: z.string().min(1, "messageId is required"),
	reason: z.string().optional(),
	content: jsonObjectSchema.optional(),
});

/** Validate and normalize {@link createRoom} input, throwing on error. */
export function parseCreateRoomInput(input: unknown) {
	const result = createRoomSchema.safeParse(input);
	if (!result.success) {
		throw new ChatCoreError(
			`Invalid createRoom input: ${result.error.issues.map((i) => i.message).join(", ")}`,
		);
	}
	return result.data;
}

/** Validate and normalize {@link publishEvent} input, throwing on error. */
export function parsePublishEventInput(input: unknown) {
	const result = publishEventSchema.safeParse(input);
	if (!result.success) {
		throw new ChatCoreError(
			`Invalid publishEvent input: ${result.error.issues.map((i) => i.message).join(", ")}`,
		);
	}
	return result.data;
}

/** Validate and normalize {@link sendMessage} input, throwing on error. */
export function parseSendMessageInput(input: unknown) {
	const result = sendMessageSchema.safeParse(input);
	if (!result.success) {
		throw new ChatCoreError(
			`Invalid sendMessage input: ${result.error.issues.map((i) => i.message).join(", ")}`,
		);
	}
	return result.data;
}

/** Validate and normalize {@link editMessage} input, throwing on error. */
export function parseEditMessageInput(input: unknown) {
	const result = editMessageSchema.safeParse(input);
	if (!result.success) {
		throw new ChatCoreError(
			`Invalid editMessage input: ${result.error.issues.map((i) => i.message).join(", ")}`,
		);
	}
	return result.data;
}

/** Validate and normalize {@link deleteMessage} input, throwing on error. */
export function parseDeleteMessageInput(input: unknown) {
	const result = deleteMessageSchema.safeParse(input);
	if (!result.success) {
		throw new ChatCoreError(
			`Invalid deleteMessage input: ${result.error.issues.map((i) => i.message).join(", ")}`,
		);
	}
	return result.data;
}
