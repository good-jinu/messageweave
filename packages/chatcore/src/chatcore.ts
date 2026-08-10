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
	createRoom(input: CreateRoomInput): Promise<Room>;
	getRoom(roomId: string): Promise<Room | null>;
	listRooms(options?: ListRoomsOptions): Promise<Room[]>;
	publishEvent(input: PublishEventInput): Promise<PublishEventResult>;
	sendMessage(input: SendMessageInput): Promise<PublishEventResult>;
	getRoomState(roomId: string): Promise<FlowEvent[]>;
	getRoomTimeline(
		roomId: string,
		options?: GetTimelineOptions,
	): Promise<FlowEvent[]>;
	getSyncStream(options?: GetSyncStreamOptions): Promise<SyncStreamResult>;
}

/**
 * Create an in-process, event-sourced messaging engine backed by the supplied
 * ChatCore storage backend.
 *
 * @example
 * ```ts
 * import { createChatCore } from "chatcore";
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
	const { sendMessage } = createMessageMethods(publishEvent);
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
		getRoomState,
		getRoomTimeline,
		getSyncStream,
	};
}
