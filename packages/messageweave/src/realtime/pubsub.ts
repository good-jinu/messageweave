import type { FlowEvent, PubSubAdapter } from "../types";

/**
 * Creates a zero-dependency, in-process {@link PubSubAdapter}.
 * Used as the default pub/sub engine when no external broker (like Redis or NATS) is provided.
 *
 * @example
 * ```ts
 * import { createMemoryPubSub } from "messageweave";
 *
 * const pubsub = createMemoryPubSub();
 * const unsubscribe = pubsub.subscribe("room:general", (event) => {
 *   console.log("Received event:", event);
 * });
 * ```
 */
export function createMemoryPubSub(): PubSubAdapter {
	const subscribers = new Map<
		string,
		Set<(event: FlowEvent) => void | Promise<void>>
	>();

	return {
		publish(channel: string, event: FlowEvent): void {
			const set = subscribers.get(channel);
			if (!set || set.size === 0) return;

			for (const handler of Array.from(set)) {
				try {
					const result = handler(event);
					if (result instanceof Promise) {
						result.catch(() => {});
					}
				} catch {
					// Ignore synchronous subscriber errors so other subscribers still receive the event
				}
			}
		},

		subscribe(
			channel: string,
			onEvent: (event: FlowEvent) => void | Promise<void>,
		): () => void {
			let set = subscribers.get(channel);
			if (!set) {
				set = new Set();
				subscribers.set(channel, set);
			}
			set.add(onEvent);

			return () => {
				const current = subscribers.get(channel);
				if (current) {
					current.delete(onEvent);
					if (current.size === 0) {
						subscribers.delete(channel);
					}
				}
			};
		},
	};
}
