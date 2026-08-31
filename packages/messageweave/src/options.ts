import type { MessageWeaveStorage } from "./storage";
import type { MessageWeaveHooks, PubSubAdapter } from "./types";

/**
 * Configuration for {@link createMessageWeave}.
 */
export interface MessageWeaveOptions {
	/**
	 * Storage backend used by MessageWeave. Applications can implement this with
	 * Kysely, Drizzle, Prisma, raw SQL, or any other persistence layer.
	 */
	storage: MessageWeaveStorage;
	/**
	 * Default page size for {@link MessageWeave.getRoomTimeline} and
	 * {@link MessageWeave.getSyncStream}.
	 *
	 * @default 100
	 */
	defaultLimit?: number;
	/**
	 * Maximum allowed byte length of the serialized `content` payload per
	 * event (`JSON.stringify` UTF-8 byte length). When set, {@link MessageWeave.publishEvent}
	 * rejects oversized content with a `MessageWeaveError`. The host owns this
	 * number; omit for no limit (today's behavior).
	 *
	 * @default undefined (unbounded)
	 */
	maxContentBytes?: number;
	/**
	 * Lifecycle hooks for intercepting and reacting to engine actions.
	 */
	hooks?: MessageWeaveHooks;
	/**
	 * Pub/Sub adapter for real-time multi-node event distribution.
	 * When omitted, an in-memory PubSub is used automatically.
	 */
	pubsub?: PubSubAdapter;
}

/** Backwards-compatible alias for {@link MessageWeaveOptions}. */
export type ChatCoreOptions = MessageWeaveOptions;
