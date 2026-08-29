import { createFlowAdapter } from "./db/adapter";
import { createSequencer } from "./db/sequence";
import { createMessageMethods } from "./engine/messages";
import { createPublishMethod } from "./engine/publish";
import { createRoomMethods } from "./engine/rooms";
import { createStateMethods } from "./engine/state";
import { createSyncMethods } from "./engine/sync";
import { createTimelineMethods } from "./engine/timeline";
import type { ChatCoreOptions } from "./options";
import type {
	CreateRoomInput,
	DeleteMessageInput,
	EditMessageInput,
	FlowEvent,
	GetSyncStreamOptions,
	GetTimelineOptions,
	ListRoomsOptions,
	PublishEventInput,
	PublishEventResult,
	Room,
	SendMessageInput,
	SyncStreamResult,
} from "./types";

/** The ChatCore engine instance returned by {@link createChatCore}. */
export interface ChatCore {
	/** The resolved options. */
	readonly options: ChatCoreOptions;
	/** Create a conversation room. */
	createRoom(input: CreateRoomInput): Promise<Room>;
	/** Fetch a room by id, or return `null` when it does not exist. */
	getRoom(roomId: string): Promise<Room | null>;
	/** List rooms ordered by creation time. */
	listRooms(options?: ListRoomsOptions): Promise<Room[]>;
	/** Append an immutable event to a room. */
	publishEvent(input: PublishEventInput): Promise<PublishEventResult>;
	/** Append a plain-text message event to a room. */
	sendMessage(input: SendMessageInput): Promise<PublishEventResult>;
	/** Publish an edit revision for an existing message in a room. */
	editMessage(input: EditMessageInput): Promise<PublishEventResult>;
	/** Publish a tombstone event deleting an existing message in a room. */
	deleteMessage(input: DeleteMessageInput): Promise<PublishEventResult>;
	/** Read the latest state event for every state key in a room. */
	getRoomState(roomId: string): Promise<FlowEvent[]>;
	/** Read a page of a room's event timeline. */
	getRoomTimeline(
		roomId: string,
		options?: GetTimelineOptions,
	): Promise<FlowEvent[]>;
	/** Read globally ordered events after a synchronization cursor. */
	getSyncStream(options?: GetSyncStreamOptions): Promise<SyncStreamResult>;
}

/**
 * Create an in-process, event-sourced messaging engine backed by the supplied
 * ChatCore storage backend.
 *
 * @example
 * ```ts
 * import { createChatCore } from "messageweave";
 *
 * const flow = createChatCore({ storage });
 * const room = await flow.createRoom({ creatorId: "u1" });
 * await flow.sendMessage({
 *   roomId: room.id,
 *   senderId: "u1",
 *   body: "hello",
 * });
 * const { events, nextToken } = await flow.getSyncStream({ sinceSequenceId: 0 });
 * ```
 */
export function createChatCore(options: ChatCoreOptions): ChatCore {
	const adapter = createFlowAdapter(options);
	const sequencer = createSequencer(adapter);
	const defaultLimit = options.defaultLimit ?? 100;

	const { createRoom, getRoom, listRooms } = createRoomMethods(
		adapter,
		defaultLimit,
	);
	const { publishEvent } = createPublishMethod(adapter, sequencer, {
		maxContentBytes: options.maxContentBytes,
	});
	const { sendMessage, editMessage, deleteMessage } =
		createMessageMethods(publishEvent);
	const { getRoomState } = createStateMethods(adapter);
	const { getRoomTimeline } = createTimelineMethods(adapter, defaultLimit);
	const { getSyncStream } = createSyncMethods(adapter, defaultLimit);

	return {
		options,
		createRoom,
		getRoom,
		listRooms,
		publishEvent,
		sendMessage,
		editMessage,
		deleteMessage,
		getRoomState,
		getRoomTimeline,
		getSyncStream,
	};
}
