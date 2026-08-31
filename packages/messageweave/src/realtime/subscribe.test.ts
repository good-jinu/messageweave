import { describe, expect, it } from "vitest";
import { getTestInstance } from "../test-utils";
import type { FlowEvent } from "../types";

import { createMemoryPubSub } from "./pubsub";

describe("flow.subscribe", () => {
	it("yields live events as they are published", async () => {
		const { flow } = getTestInstance();
		const room = await flow.createRoom({ creatorId: "u1" });

		const stream = flow.subscribe({ roomId: room.id });
		const iterator = stream[Symbol.asyncIterator]();

		// Start waiting for the first live event
		const nextPromise = iterator.next();

		const published = await flow.sendMessage({
			roomId: room.id,
			senderId: "u1",
			body: "Hello live!",
		});

		const result = await nextPromise;
		expect(result.done).toBe(false);
		expect(result.value.id).toBe(published.event.id);
		expect(result.value.content).toEqual({ body: "Hello live!" });

		// Close iterator
		await iterator.return?.();
	});

	it("streams historical missed events and then transitions to live events", async () => {
		const { flow } = getTestInstance();
		const room = await flow.createRoom({ creatorId: "u1" });

		// Publish 3 initial messages
		const m1 = await flow.sendMessage({
			roomId: room.id,
			senderId: "u1",
			body: "msg1",
		});
		const m2 = await flow.sendMessage({
			roomId: room.id,
			senderId: "u1",
			body: "msg2",
		});
		const m3 = await flow.sendMessage({
			roomId: room.id,
			senderId: "u1",
			body: "msg3",
		});

		// Subscribe starting from after m1 (sinceSequenceId = m1.sequenceId)
		const controller = new AbortController();
		const eventsReceived: FlowEvent[] = [];

		const consumePromise = (async () => {
			for await (const event of flow.subscribe({
				roomId: room.id,
				sinceSequenceId: m1.sequenceId,
				signal: controller.signal,
			})) {
				eventsReceived.push(event);
				if (eventsReceived.length === 3) {
					controller.abort();
				}
			}
		})();

		// Wait briefly for historical catch-up, then publish a new live message (m4)
		await new Promise((resolve) => setTimeout(resolve, 20));
		const m4 = await flow.sendMessage({
			roomId: room.id,
			senderId: "u1",
			body: "msg4 (live)",
		});

		await consumePromise;

		expect(eventsReceived).toHaveLength(3);
		expect(eventsReceived[0]!.id).toBe(m2.event.id);
		expect(eventsReceived[1]!.id).toBe(m3.event.id);
		expect(eventsReceived[2]!.id).toBe(m4.event.id);
	});

	it("filters events by roomId", async () => {
		const { flow } = getTestInstance();
		const roomA = await flow.createRoom({ creatorId: "u1" });
		const roomB = await flow.createRoom({ creatorId: "u1" });

		const stream = flow.subscribe({ roomId: roomA.id });
		const iterator = stream[Symbol.asyncIterator]();

		const nextPromise = iterator.next();

		// Publish to roomB (should be ignored by roomA subscriber)
		await flow.sendMessage({
			roomId: roomB.id,
			senderId: "u1",
			body: "To room B",
		});

		// Publish to roomA
		const msgA = await flow.sendMessage({
			roomId: roomA.id,
			senderId: "u1",
			body: "To room A",
		});

		const result = await nextPromise;
		expect(result.value.id).toBe(msgA.event.id);
		expect(result.value.roomId).toBe(roomA.id);

		await iterator.return?.();
	});

	it("filters events by event types", async () => {
		const { flow } = getTestInstance();
		const room = await flow.createRoom({ creatorId: "u1" });

		const controller = new AbortController();
		const eventsReceived: FlowEvent[] = [];

		const consumePromise = (async () => {
			for await (const event of flow.subscribe({
				roomId: room.id,
				types: ["message.text", "custom.*"],
				signal: controller.signal,
			})) {
				eventsReceived.push(event);
				if (eventsReceived.length === 2) {
					controller.abort();
				}
			}
		})();

		// Wait briefly
		await new Promise((resolve) => setTimeout(resolve, 10));

		// Publish a state event (should be filtered out)
		await flow.publishEvent({
			roomId: room.id,
			senderId: "u1",
			type: "room.state.topic",
			stateKey: "",
			content: { topic: "General discussions" },
		});

		// Publish matched events
		const textMsg = await flow.sendMessage({
			roomId: room.id,
			senderId: "u1",
			body: "hello",
		});
		const customMsg = await flow.publishEvent({
			roomId: room.id,
			senderId: "u1",
			type: "custom.action",
			content: { action: "ping" },
		});

		await consumePromise;

		expect(eventsReceived).toHaveLength(2);
		expect(eventsReceived[0]!.type).toBe("message.text");
		expect(eventsReceived[0]!.id).toBe(textMsg.event.id);
		expect(eventsReceived[1]!.type).toBe("custom.action");
		expect(eventsReceived[1]!.id).toBe(customMsg.event.id);
	});

	it("aborts cleanly when AbortSignal triggers", async () => {
		const { flow } = getTestInstance();
		const room = await flow.createRoom({ creatorId: "u1" });

		const controller = new AbortController();
		const stream = flow.subscribe({
			roomId: room.id,
			signal: controller.signal,
		});
		const iterator = stream[Symbol.asyncIterator]();

		const nextPromise = iterator.next();
		controller.abort();

		const result = await nextPromise;
		expect(result.done).toBe(true);
	});

	it("supports custom PubSubAdapter for multi-instance scaling", async () => {
		// Simulate two separate MessageWeave instances sharing a single PubSubAdapter
		const sharedPubSub = createMemoryPubSub();
		const { createMemoryStorage } = await import(
			"../test-utils/memory-storage"
		);
		const db = {
			room: [],
			event: [],
			eventEdge: [],
			roomState: [],
			sequence: [],
		};
		const { createMessageWeave } = await import("../messageweave");

		const instanceA = createMessageWeave({
			storage: createMemoryStorage(db),
			pubsub: sharedPubSub,
		});

		const instanceB = createMessageWeave({
			storage: createMemoryStorage(db),
			pubsub: sharedPubSub,
		});

		const room = await instanceA.createRoom({ creatorId: "u1" });

		// Subscribe on Instance B
		const stream = instanceB.subscribe({ roomId: room.id });
		const iterator = stream[Symbol.asyncIterator]();
		const nextPromise = iterator.next();

		// Publish on Instance A
		const published = await instanceA.sendMessage({
			roomId: room.id,
			senderId: "u1",
			body: "Cross-instance realtime message!",
		});

		const result = await nextPromise;
		expect(result.done).toBe(false);
		expect(result.value.id).toBe(published.event.id);
		expect(result.value.content).toEqual({
			body: "Cross-instance realtime message!",
		});

		await iterator.return?.();
	});
});
