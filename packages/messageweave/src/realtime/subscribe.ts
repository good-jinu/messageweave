import type {
	EventStream,
	FlowEvent,
	GetSyncStreamOptions,
	PubSubAdapter,
	SubscribeOptions,
	SyncStreamResult,
} from "../types";

/** Internal queue for managing asynchronous push/pull streams. */
interface AsyncQueue<T> {
	push(item: T): void;
	close(): void;
	next(): Promise<IteratorResult<T>>;
}

function createAsyncQueue<T>(maxBufferSize = 1000): AsyncQueue<T> {
	const items: T[] = [];
	const waiters: Array<(result: IteratorResult<T>) => void> = [];
	let isClosed = false;

	return {
		push(item: T) {
			if (isClosed) return;
			const waiter = waiters.shift();
			if (waiter) {
				waiter({ value: item, done: false });
			} else if (items.length < maxBufferSize) {
				items.push(item);
			}
		},

		close() {
			if (isClosed) return;
			isClosed = true;
			while (waiters.length > 0) {
				const waiter = waiters.shift()!;
				waiter({ value: undefined as unknown as T, done: true });
			}
			items.length = 0;
		},

		async next(): Promise<IteratorResult<T>> {
			if (items.length > 0) {
				return { value: items.shift()!, done: false };
			}
			if (isClosed) {
				return { value: undefined as unknown as T, done: true };
			}
			return new Promise<IteratorResult<T>>((resolve) => {
				waiters.push(resolve);
			});
		},
	};
}

function matchesTypeFilter(type: string, filterList?: string[]): boolean {
	if (!filterList || filterList.length === 0) return true;
	for (const pattern of filterList) {
		if (pattern === "*" || pattern === type) return true;
		if (pattern.endsWith("*") && type.startsWith(pattern.slice(0, -1))) {
			return true;
		}
	}
	return false;
}

/**
 * Creates the `subscribe` method for the MessageWeave engine.
 * @internal
 */
export function createSubscribeMethod(
	pubsub: PubSubAdapter,
	getSyncStream: (options?: GetSyncStreamOptions) => Promise<SyncStreamResult>,
) {
	return function subscribe(options: SubscribeOptions = {}): EventStream {
		const queue = createAsyncQueue<FlowEvent>(options.bufferSize ?? 1000);

		let unsubscribe: (() => void | Promise<void>) | null = null;
		let isCleanedUp = false;
		let lastStreamedSequenceId = options.sinceSequenceId ?? -1;

		const channel = options.roomId ? `room:${options.roomId}` : "events";

		const cleanup = async () => {
			if (isCleanedUp) return;
			isCleanedUp = true;
			queue.close();
			if (typeof unsubscribe === "function") {
				try {
					const res = unsubscribe();
					if (res instanceof Promise) {
						await res;
					}
				} catch {
					// Ignore unsubscribe errors
				}
				unsubscribe = null;
			}
		};

		if (options.signal) {
			if (options.signal.aborted) {
				void cleanup();
			} else {
				options.signal.addEventListener(
					"abort",
					() => {
						void cleanup();
					},
					{
						once: true,
					},
				);
			}
		}

		// Buffer for live events received while catch-up sync is in progress
		const liveBuffer: FlowEvent[] = [];
		let isHistoricalSyncDone = options.sinceSequenceId === undefined;

		const handleIncomingLiveEvent = (event: FlowEvent) => {
			if (isCleanedUp) return;

			// Check room filter
			if (options.roomId && event.roomId !== options.roomId) {
				return;
			}

			// Check type filter
			if (!matchesTypeFilter(event.type, options.types)) {
				return;
			}

			if (!isHistoricalSyncDone) {
				liveBuffer.push(event);
			} else if (event.sequenceId > lastStreamedSequenceId) {
				lastStreamedSequenceId = event.sequenceId;
				queue.push(event);
			}
		};

		// 1. Subscribe to live PubSub first to ensure no events are missed during catchup
		const subResult = pubsub.subscribe(channel, handleIncomingLiveEvent);
		if (subResult instanceof Promise) {
			subResult
				.then((unsub) => {
					if (isCleanedUp) {
						try {
							const res = unsub();
							if (res instanceof Promise) res.catch(() => {});
						} catch {}
					} else {
						unsubscribe = unsub;
					}
				})
				.catch(() => {});
		} else {
			unsubscribe = subResult;
		}

		// 2. Perform catch-up sync if sinceSequenceId is requested
		void (async () => {
			if (options.sinceSequenceId !== undefined) {
				let cursor = options.sinceSequenceId;
				const syncLimit = 100;

				while (!isCleanedUp) {
					try {
						const result = await getSyncStream({
							roomIds: options.roomId ? [options.roomId] : undefined,
							sinceSequenceId: cursor,
							limit: syncLimit,
						});

						for (const event of result.events) {
							if (isCleanedUp) break;
							if (matchesTypeFilter(event.type, options.types)) {
								queue.push(event);
							}
							if (event.sequenceId > lastStreamedSequenceId) {
								lastStreamedSequenceId = event.sequenceId;
							}
						}

						// If we received fewer events than the limit, we reached the head
						if (result.events.length < syncLimit) {
							break;
						}
						cursor = result.nextToken;
					} catch {
						// On storage failure, proceed to live stream
						break;
					}
				}

				// 3. Replay any live events that arrived during catch-up, discarding duplicates
				isHistoricalSyncDone = true;
				for (const event of liveBuffer) {
					if (isCleanedUp) break;
					if (event.sequenceId > lastStreamedSequenceId) {
						lastStreamedSequenceId = event.sequenceId;
						queue.push(event);
					}
				}
				liveBuffer.length = 0;
			}
		})();

		return {
			[Symbol.asyncIterator]() {
				return {
					next: () => queue.next(),
					return: async () => {
						await cleanup();
						return { value: undefined as unknown as FlowEvent, done: true };
					},
				};
			},
			return: async () => {
				await cleanup();
				return { value: undefined as unknown as FlowEvent, done: true };
			},
		};
	};
}
