import { beforeEach, describe, expect, it } from "vitest";
import { createMessageWeave, projectTimeline } from "./index";
import type { TestInstance } from "./test-utils";
import { getTestInstance } from "./test-utils";
import { createMemoryStorage } from "./test-utils/memory-storage";
import type { AttachmentReference } from "./types";
import { ChatCoreError, MessageWeaveError } from "./utils/validate";

// Helper: publish N events to a room
async function publishN(flow: TestInstance["flow"], roomId: string, n: number) {
	for (let i = 0; i < n; i++) {
		await flow.publishEvent({
			roomId,
			senderId: "u1",
			type: "msg",
			content: { i },
		});
	}
}

let t: TestInstance;

beforeEach(() => {
	t = getTestInstance();
});

describe("rooms", () => {
	it("creates and fetches a room", async () => {
		const room = await t.flow.createRoom({
			creatorId: "u1",
			metadata: { name: "general" },
		});
		expect(room.id).toBeTruthy();
		expect(room.creatorId).toBe("u1");
		expect(room.metadata).toEqual({ name: "general" });
		expect(typeof room.createdAt).toBe("number");

		const fetched = await t.flow.getRoom(room.id);
		expect(fetched).toEqual(room);
	});

	it("returns null for an unknown room", async () => {
		expect(await t.flow.getRoom("does-not-exist")).toBeNull();
	});

	it("lists rooms oldest-first by default", async () => {
		const first = await t.flow.createRoom({
			creatorId: "u1",
			metadata: { name: "first" },
		});
		const second = await t.flow.createRoom({
			creatorId: "u1",
			metadata: { name: "second" },
		});
		const roomRows = t.db.room!;
		roomRows[0]!.createdAt = 1;
		roomRows[1]!.createdAt = 2;

		const rooms = await t.flow.listRooms();
		expect(rooms.map((room) => room.id)).toEqual([first.id, second.id]);
	});

	it("lists rooms with order and limit options", async () => {
		await t.flow.createRoom({
			creatorId: "u1",
			metadata: { name: "first" },
		});
		const second = await t.flow.createRoom({
			creatorId: "u1",
			metadata: { name: "second" },
		});
		await t.flow.createRoom({
			creatorId: "u1",
			metadata: { name: "third" },
		});
		const roomRows = t.db.room!;
		roomRows[0]!.createdAt = 1;
		roomRows[1]!.createdAt = 2;
		roomRows[2]!.createdAt = 3;

		const rooms = await t.flow.listRooms({ order: "desc", limit: 2 });
		expect(rooms.map((room) => room.id)).toEqual([roomRows[2]!.id, second.id]);
	});

	it("rejects a room without a creator", async () => {
		await expect(
			// @ts-expect-error testing invalid input
			t.flow.createRoom({}),
		).rejects.toBeInstanceOf(MessageWeaveError);
	});

	it("rejects metadata that is not JSON-serializable", async () => {
		await expect(
			t.flow.createRoom({
				creatorId: "u1",
				// @ts-expect-error testing invalid input
				metadata: { createdAt: new Date() },
			}),
		).rejects.toBeInstanceOf(MessageWeaveError);
	});

	it("supports ChatCoreError as backward-compatible alias", () => {
		expect(ChatCoreError).toBe(MessageWeaveError);
	});
});

describe("publishEvent", () => {
	it("assigns strictly increasing, gap-free sequence ids", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		const results = [];
		for (let i = 0; i < 5; i++) {
			results.push(
				await t.flow.publishEvent({
					roomId: room.id,
					senderId: "u1",
					type: "message.text",
					content: { body: `msg ${i}` },
				}),
			);
		}
		expect(results.map((r) => r.sequenceId)).toEqual([1, 2, 3, 4, 5]);
		expect(results[0]!.event.content).toEqual({ body: "msg 0" });
	});

	it("keeps sequence ids monotonic under concurrent publishes", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		const published = await Promise.all(
			Array.from({ length: 25 }, (_, i) =>
				t.flow.publishEvent({
					roomId: room.id,
					senderId: "u1",
					type: "message.text",
					content: { i },
				}),
			),
		);
		const seqs = published.map((p) => p.sequenceId).sort((a, b) => a - b);
		expect(seqs).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
		expect(new Set(seqs).size).toBe(25);
	});

	it("maintains unique monotonic sequence IDs across multiple distinct engine instances sharing storage", async () => {
		const sharedDb = {
			room: [],
			event: [],
			eventEdge: [],
			roomState: [],
			sequence: [],
		};

		// Create 5 distinct MessageWeave instances simulating separate Node processes / serverless workers
		const instances = Array.from({ length: 5 }, () =>
			createMessageWeave({
				storage: createMemoryStorage(sharedDb),
			}),
		);

		const room = await instances[0]!.createRoom({ creatorId: "u1" });

		// Concurrently publish events from all 5 instances
		const publishPromises: Promise<{ sequenceId: number }>[] = [];
		for (let i = 0; i < 25; i++) {
			const instance = instances[i % instances.length]!;
			publishPromises.push(
				instance.publishEvent({
					roomId: room.id,
					senderId: `u${(i % 5) + 1}`,
					type: "message.text",
					content: { i },
				}),
			);
		}

		const results = await Promise.all(publishPromises);
		const seqs = results.map((r) => r.sequenceId).sort((a, b) => a - b);

		expect(seqs).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
		expect(new Set(seqs).size).toBe(25);
	});

	it("persists edges for parent event ids", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		const parent = await t.flow.publishEvent({
			roomId: room.id,
			senderId: "u1",
			type: "message.text",
			content: { body: "parent" },
		});
		const reply = await t.flow.publishEvent({
			roomId: room.id,
			senderId: "u2",
			type: "message.text",
			content: { body: "reply" },
			parentEventIds: [parent.event.id],
		});

		const edges = t.db.eventEdge!;
		expect(edges).toHaveLength(1);
		expect(edges[0]).toMatchObject({
			eventId: reply.event.id,
			parentEventId: parent.event.id,
		});
	});

	it("rejects an event missing required fields", async () => {
		await expect(
			t.flow.publishEvent({
				roomId: "",
				senderId: "u1",
				type: "message.text",
			}),
		).rejects.toBeInstanceOf(MessageWeaveError);
	});

	it("rejects content that is not JSON-serializable", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		await expect(
			t.flow.publishEvent({
				roomId: room.id,
				senderId: "u1",
				type: "message.text",
				// @ts-expect-error testing invalid input
				content: { sentAt: new Date() },
			}),
		).rejects.toBeInstanceOf(MessageWeaveError);
	});
});

describe("sendMessage", () => {
	it("publishes a text message", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });

		const result = await t.flow.sendMessage({
			roomId: room.id,
			senderId: "u1",
			body: "hello",
		});

		expect(result.event.type).toBe("message.text");
		expect(result.event.content).toEqual({ body: "hello" });
	});

	it("supports replies", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		const parent = await t.flow.sendMessage({
			roomId: room.id,
			senderId: "u1",
			body: "parent",
		});

		const reply = await t.flow.sendMessage({
			roomId: room.id,
			senderId: "u2",
			body: "reply",
			parentEventIds: [parent.event.id],
		});

		expect(t.db.eventEdge).toContainEqual({
			id: expect.any(String),
			eventId: reply.event.id,
			parentEventId: parent.event.id,
		});
	});

	it("rejects whitespace-only messages", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });

		await expect(
			t.flow.sendMessage({
				roomId: room.id,
				senderId: "u1",
				body: "   ",
			}),
		).rejects.toBeInstanceOf(MessageWeaveError);
	});
});

describe("editMessage", () => {
	it("publishes an edit revision linking to the target message", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		const original = await t.flow.sendMessage({
			roomId: room.id,
			senderId: "u1",
			body: "original text",
		});

		const editResult = await t.flow.editMessage({
			roomId: room.id,
			senderId: "u1",
			messageId: original.event.id,
			body: "edited text",
		});

		expect(editResult.event.type).toBe("message.edit");
		expect(editResult.event.content.body).toBe("edited text");
		expect(typeof editResult.event.content.editedAt).toBe("number");
		expect(editResult.sequenceId).toBeGreaterThan(original.sequenceId);

		// Event edge created linking to target message
		expect(t.db.eventEdge).toContainEqual({
			id: expect.any(String),
			eventId: editResult.event.id,
			parentEventId: original.event.id,
		});
	});

	it("rejects whitespace-only edit body", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		const original = await t.flow.sendMessage({
			roomId: room.id,
			senderId: "u1",
			body: "original text",
		});

		await expect(
			t.flow.editMessage({
				roomId: room.id,
				senderId: "u1",
				messageId: original.event.id,
				body: "   ",
			}),
		).rejects.toBeInstanceOf(MessageWeaveError);
	});

	it("rejects editing a non-existent message ID", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		await expect(
			t.flow.editMessage({
				roomId: room.id,
				senderId: "u1",
				messageId: "nonexistent-id",
				body: "new body",
			}),
		).rejects.toBeInstanceOf(MessageWeaveError);
	});

	it("rejects editing a message from a different room", async () => {
		const room1 = await t.flow.createRoom({ creatorId: "u1" });
		const room2 = await t.flow.createRoom({ creatorId: "u1" });
		const original = await t.flow.sendMessage({
			roomId: room1.id,
			senderId: "u1",
			body: "room1 message",
		});

		await expect(
			t.flow.editMessage({
				roomId: room2.id,
				senderId: "u1",
				messageId: original.event.id,
				body: "new body in room2",
			}),
		).rejects.toBeInstanceOf(MessageWeaveError);
	});
});

describe("deleteMessage", () => {
	it("publishes a tombstone delete event linking to the target message", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		const original = await t.flow.sendMessage({
			roomId: room.id,
			senderId: "u1",
			body: "message to be deleted",
		});

		const deleteResult = await t.flow.deleteMessage({
			roomId: room.id,
			senderId: "u1",
			messageId: original.event.id,
			reason: "user requested",
		});

		expect(deleteResult.event.type).toBe("message.delete");
		expect(deleteResult.event.content.tombstone).toBe(true);
		expect(deleteResult.event.content.reason).toBe("user requested");
		expect(typeof deleteResult.event.content.deletedAt).toBe("number");
		expect(deleteResult.sequenceId).toBeGreaterThan(original.sequenceId);

		expect(t.db.eventEdge).toContainEqual({
			id: expect.any(String),
			eventId: deleteResult.event.id,
			parentEventId: original.event.id,
		});
	});

	it("rejects deleting a non-existent message ID", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		await expect(
			t.flow.deleteMessage({
				roomId: room.id,
				senderId: "u1",
				messageId: "nonexistent-id",
			}),
		).rejects.toBeInstanceOf(MessageWeaveError);
	});
});

describe("projectTimeline", () => {
	it("projects single and multiple revisions cleanly into projected messages", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		const msg1 = await t.flow.sendMessage({
			roomId: room.id,
			senderId: "u1",
			body: "first message",
		});
		const msg2 = await t.flow.sendMessage({
			roomId: room.id,
			senderId: "u2",
			body: "second message",
		});

		// Edit msg1
		await t.flow.editMessage({
			roomId: room.id,
			senderId: "u1",
			messageId: msg1.event.id,
			body: "first message (edit 1)",
		});

		// Edit msg1 again
		await t.flow.editMessage({
			roomId: room.id,
			senderId: "u1",
			messageId: msg1.event.id,
			body: "first message (edit 2)",
		});

		const rawEvents = await t.flow.getRoomTimeline(room.id, { limit: 100 });
		const projected = projectTimeline(rawEvents);

		expect(projected).toHaveLength(2);
		expect(projected[0]!.id).toBe(msg1.event.id);
		expect(projected[0]!.body).toBe("first message (edit 2)");
		expect(projected[0]!.isEdited).toBe(true);
		expect(projected[0]!.editCount).toBe(2);
		expect(projected[0]!.rawEvents).toHaveLength(3); // original + 2 edits

		expect(projected[1]!.id).toBe(msg2.event.id);
		expect(projected[1]!.body).toBe("second message");
		expect(projected[1]!.isEdited).toBe(false);
		expect(projected[1]!.editCount).toBe(0);
	});

	it("handles message deletion and includeDeleted option", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		const msg1 = await t.flow.sendMessage({
			roomId: room.id,
			senderId: "u1",
			body: "msg1",
		});
		const msg2 = await t.flow.sendMessage({
			roomId: room.id,
			senderId: "u2",
			body: "msg2",
		});

		await t.flow.deleteMessage({
			roomId: room.id,
			senderId: "u1",
			messageId: msg1.event.id,
			reason: "retracted",
		});

		const rawEvents = await t.flow.getRoomTimeline(room.id, { limit: 100 });

		// Default includeDeleted: true
		const withTombstones = projectTimeline(rawEvents);
		expect(withTombstones).toHaveLength(2);
		expect(withTombstones[0]!.id).toBe(msg1.event.id);
		expect(withTombstones[0]!.isDeleted).toBe(true);
		expect(withTombstones[0]!.body).toBe("");
		expect(withTombstones[0]!.deleteReason).toBe("retracted");
		expect(typeof withTombstones[0]!.deletedAt).toBe("number");

		// Filter out deleted: includeDeleted: false
		const withoutDeleted = projectTimeline(rawEvents, {
			includeDeleted: false,
		});
		expect(withoutDeleted).toHaveLength(1);
		expect(withoutDeleted[0]!.id).toBe(msg2.event.id);
	});
});

describe("room state projection", () => {
	it("upserts the latest state event per [type, stateKey]", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		await t.flow.publishEvent({
			roomId: room.id,
			senderId: "u1",
			type: "room.state.name",
			stateKey: "",
			content: { name: "first" },
		});
		const latest = await t.flow.publishEvent({
			roomId: room.id,
			senderId: "u1",
			type: "room.state.name",
			stateKey: "",
			content: { name: "second" },
		});

		const state = await t.flow.getRoomState(room.id);
		expect(state).toHaveLength(1);
		expect(state[0]!.id).toBe(latest.event.id);
		expect(state[0]!.content).toEqual({ name: "second" });
		// projection cache stores exactly one row for the composite key
		expect(t.db.roomState).toHaveLength(1);
	});

	it("tracks distinct state keys independently", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		await t.flow.publishEvent({
			roomId: room.id,
			senderId: "u1",
			type: "room.member",
			stateKey: "u1",
			content: { membership: "join" },
		});
		await t.flow.publishEvent({
			roomId: room.id,
			senderId: "u2",
			type: "room.member",
			stateKey: "u2",
			content: { membership: "join" },
		});

		const state = await t.flow.getRoomState(room.id);
		expect(state).toHaveLength(2);
	});

	it("does not project non-state events", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		await t.flow.publishEvent({
			roomId: room.id,
			senderId: "u1",
			type: "message.text",
			content: { body: "hi" },
		});
		expect(await t.flow.getRoomState(room.id)).toHaveLength(0);
	});
});

describe("getRoomTimeline", () => {
	it("returns events newest-first and respects limit + beforeSequenceId", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		for (let i = 0; i < 5; i++) {
			await t.flow.publishEvent({
				roomId: room.id,
				senderId: "u1",
				type: "message.text",
				content: { i },
			});
		}

		const firstPage = await t.flow.getRoomTimeline(room.id, { limit: 2 });
		expect(firstPage.map((e) => e.sequenceId)).toEqual([5, 4]);

		const nextPage = await t.flow.getRoomTimeline(room.id, {
			limit: 2,
			beforeSequenceId: firstPage[firstPage.length - 1]!.sequenceId,
		});
		expect(nextPage.map((e) => e.sequenceId)).toEqual([3, 2]);
	});

	it("scopes the timeline to a single room", async () => {
		const a = await t.flow.createRoom({ creatorId: "u1" });
		const b = await t.flow.createRoom({ creatorId: "u1" });
		await t.flow.publishEvent({
			roomId: a.id,
			senderId: "u1",
			type: "message.text",
			content: {},
		});
		await t.flow.publishEvent({
			roomId: b.id,
			senderId: "u1",
			type: "message.text",
			content: {},
		});
		expect(await t.flow.getRoomTimeline(a.id)).toHaveLength(1);
	});
});

describe("getSyncStream", () => {
	it("returns events after a token, oldest-first, with a resumable nextToken", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		for (let i = 0; i < 3; i++) {
			await t.flow.publishEvent({
				roomId: room.id,
				senderId: "u1",
				type: "message.text",
				content: { i },
			});
		}

		const first = await t.flow.getSyncStream({ sinceSequenceId: 0 });
		expect(first.events.map((e) => e.sequenceId)).toEqual([1, 2, 3]);
		expect(first.nextToken).toBe(3);

		// publish more, then resume from the token — only new events come back
		await t.flow.publishEvent({
			roomId: room.id,
			senderId: "u1",
			type: "message.text",
			content: { i: 3 },
		});
		const second = await t.flow.getSyncStream({
			sinceSequenceId: first.nextToken,
		});
		expect(second.events.map((e) => e.sequenceId)).toEqual([4]);
		expect(second.nextToken).toBe(4);
	});

	it("spans all rooms (global stream) and paginates by limit", async () => {
		const a = await t.flow.createRoom({ creatorId: "u1" });
		const b = await t.flow.createRoom({ creatorId: "u1" });
		for (const roomId of [a.id, b.id, a.id, b.id]) {
			await t.flow.publishEvent({
				roomId,
				senderId: "u1",
				type: "message.text",
				content: {},
			});
		}

		const page = await t.flow.getSyncStream({ sinceSequenceId: 0, limit: 3 });
		expect(page.events.map((e) => e.sequenceId)).toEqual([1, 2, 3]);
		expect(page.nextToken).toBe(3);

		const rest = await t.flow.getSyncStream({
			sinceSequenceId: page.nextToken,
		});
		expect(rest.events.map((e) => e.sequenceId)).toEqual([4]);
	});

	it("returns an empty stream with a stable token when nothing is new", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		await t.flow.publishEvent({
			roomId: room.id,
			senderId: "u1",
			type: "message.text",
			content: {},
		});
		const result = await t.flow.getSyncStream({ sinceSequenceId: 1 });
		expect(result.events).toHaveLength(0);
		expect(result.nextToken).toBe(1);
	});
});

describe("getSyncStream — room scoping (§3.1)", () => {
	it("roomIds filter never returns events from foreign rooms, nextToken advances past them", async () => {
		const a = await t.flow.createRoom({ creatorId: "u1" });
		const b = await t.flow.createRoom({ creatorId: "u1" });
		const c = await t.flow.createRoom({ creatorId: "u1" }); // foreign

		// interleaved: a=1, c=2, b=3, c=4, a=5
		await t.flow.publishEvent({
			roomId: a.id,
			senderId: "u1",
			type: "msg",
			content: {},
		});
		await t.flow.publishEvent({
			roomId: c.id,
			senderId: "u1",
			type: "msg",
			content: {},
		});
		await t.flow.publishEvent({
			roomId: b.id,
			senderId: "u1",
			type: "msg",
			content: {},
		});
		await t.flow.publishEvent({
			roomId: c.id,
			senderId: "u1",
			type: "msg",
			content: {},
		});
		await t.flow.publishEvent({
			roomId: a.id,
			senderId: "u1",
			type: "msg",
			content: {},
		});

		const result = await t.flow.getSyncStream({
			sinceSequenceId: 0,
			roomIds: [a.id, b.id],
		});
		expect(result.events.map((e) => e.roomId)).not.toContain(c.id);
		expect(result.events.map((e) => e.sequenceId)).toEqual([1, 3, 5]);
		// nextToken must advance past C's seq ids (2, 4) so we don't re-scan them
		expect(result.nextToken).toBe(5);
	});

	it("roomIds: [] returns no events and a stable nextToken", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		await t.flow.publishEvent({
			roomId: room.id,
			senderId: "u1",
			type: "msg",
			content: {},
		});

		const result = await t.flow.getSyncStream({
			sinceSequenceId: 0,
			roomIds: [],
		});
		expect(result.events).toHaveLength(0);
		expect(result.nextToken).toBe(0);
	});

	it("watermark advances past foreign-room gaps on a sparse scope", async () => {
		const a = await t.flow.createRoom({ creatorId: "u1" });
		const foreign = await t.flow.createRoom({ creatorId: "u1" });

		// foreign gets seq 1-5, a gets seq 6
		await publishN(t.flow, foreign.id, 5);
		await t.flow.publishEvent({
			roomId: a.id,
			senderId: "u1",
			type: "msg",
			content: {},
		});

		// page size 3: global page covers seq 1-3; a's event is at 6
		const result = await t.flow.getSyncStream({
			sinceSequenceId: 0,
			roomIds: [a.id],
			limit: 3,
		});
		expect(result.events.map((e) => e.sequenceId)).toEqual([6]);
		// nextToken advances beyond the foreign-only prefix instead of staying at 0.
		expect(result.nextToken).toBeGreaterThanOrEqual(3);
	});

	it("back-compat: omitting roomIds returns the full global stream unchanged", async () => {
		const a = await t.flow.createRoom({ creatorId: "u1" });
		const b = await t.flow.createRoom({ creatorId: "u1" });
		await t.flow.publishEvent({
			roomId: a.id,
			senderId: "u1",
			type: "msg",
			content: {},
		});
		await t.flow.publishEvent({
			roomId: b.id,
			senderId: "u1",
			type: "msg",
			content: {},
		});

		const result = await t.flow.getSyncStream({ sinceSequenceId: 0 });
		expect(result.events.map((e) => e.sequenceId)).toEqual([1, 2]);
		expect(result.nextToken).toBe(2);
	});

	it("resumes correctly across pages with a sparse scope", async () => {
		const a = await t.flow.createRoom({ creatorId: "u1" });
		const foreign = await t.flow.createRoom({ creatorId: "u1" });

		// a=1, foreign=2, a=3, foreign=4, a=5
		await t.flow.publishEvent({
			roomId: a.id,
			senderId: "u1",
			type: "msg",
			content: {},
		});
		await t.flow.publishEvent({
			roomId: foreign.id,
			senderId: "u1",
			type: "msg",
			content: {},
		});
		await t.flow.publishEvent({
			roomId: a.id,
			senderId: "u1",
			type: "msg",
			content: {},
		});
		await t.flow.publishEvent({
			roomId: foreign.id,
			senderId: "u1",
			type: "msg",
			content: {},
		});
		await t.flow.publishEvent({
			roomId: a.id,
			senderId: "u1",
			type: "msg",
			content: {},
		});

		const page1 = await t.flow.getSyncStream({
			sinceSequenceId: 0,
			roomIds: [a.id],
			limit: 2,
		});
		expect(page1.events.map((e) => e.sequenceId)).toEqual([1, 3]);

		const page2 = await t.flow.getSyncStream({
			sinceSequenceId: page1.nextToken,
			roomIds: [a.id],
		});
		expect(page2.events.map((e) => e.sequenceId)).toEqual([5]);
		// confirm no overlap
		const allSeqs = [...page1.events, ...page2.events].map((e) => e.sequenceId);
		expect(new Set(allSeqs).size).toBe(allSeqs.length);
	});
});

describe("publishEvent — integrity (§3.2)", () => {
	it("rejects publish to a nonexistent room without consuming a sequence id", async () => {
		await expect(
			t.flow.publishEvent({
				roomId: "ghost-room",
				senderId: "u1",
				type: "msg",
			}),
		).rejects.toBeInstanceOf(MessageWeaveError);
		expect(t.db.event).toHaveLength(0);
		expect(t.db.sequence).toHaveLength(0);
	});

	it("rejects a nonexistent parentEventId without consuming a sequence id", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		await expect(
			t.flow.publishEvent({
				roomId: room.id,
				senderId: "u1",
				type: "msg",
				parentEventIds: ["does-not-exist"],
			}),
		).rejects.toBeInstanceOf(MessageWeaveError);
		expect(t.db.event).toHaveLength(0);
		expect(t.db.sequence).toHaveLength(0);
	});

	it("validates multiple parentEventIds in a single batch query", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		const p1 = await t.flow.publishEvent({
			roomId: room.id,
			senderId: "u1",
			type: "msg",
			content: { p: 1 },
		});
		const p2 = await t.flow.publishEvent({
			roomId: room.id,
			senderId: "u1",
			type: "msg",
			content: { p: 2 },
		});

		const reply = await t.flow.publishEvent({
			roomId: room.id,
			senderId: "u2",
			type: "msg",
			content: { reply: true },
			parentEventIds: [p1.event.id, p2.event.id],
		});

		expect(reply.event.id).toBeTruthy();
	});

	it("rejects a cross-room parentEventId", async () => {
		const a = await t.flow.createRoom({ creatorId: "u1" });
		const b = await t.flow.createRoom({ creatorId: "u1" });
		const { event } = await t.flow.publishEvent({
			roomId: a.id,
			senderId: "u1",
			type: "msg",
			content: {},
		});

		await expect(
			t.flow.publishEvent({
				roomId: b.id,
				senderId: "u1",
				type: "msg",
				parentEventIds: [event.id],
			}),
		).rejects.toBeInstanceOf(MessageWeaveError);
		// Only the first event should exist; no extra event or sequence consumed
		expect(t.db.event).toHaveLength(1);
	});
});

describe("publishEvent — content size ceiling (§3.3)", () => {
	it("rejects oversized content when maxContentBytes is set", async () => {
		const { flow } = getTestInstance({ maxContentBytes: 10 });
		const room = await flow.createRoom({ creatorId: "u1" });
		await expect(
			flow.publishEvent({
				roomId: room.id,
				senderId: "u1",
				type: "msg",
				content: { body: "this is definitely more than 10 bytes" },
			}),
		).rejects.toBeInstanceOf(MessageWeaveError);
	});

	it("allows content within the byte limit", async () => {
		const { flow } = getTestInstance({ maxContentBytes: 1000 });
		const room = await flow.createRoom({ creatorId: "u1" });
		await expect(
			flow.publishEvent({
				roomId: room.id,
				senderId: "u1",
				type: "msg",
				content: { body: "hi" },
			}),
		).resolves.toMatchObject({ sequenceId: 1 });
	});

	it("allows any content size when maxContentBytes is unset", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		await expect(
			t.flow.publishEvent({
				roomId: room.id,
				senderId: "u1",
				type: "msg",
				content: { body: "x".repeat(100_000) },
			}),
		).resolves.toMatchObject({ sequenceId: 1 });
	});
});

describe("attachment references", () => {
	it("stores host-owned attachment metadata in event content", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		const attachment: AttachmentReference = {
			id: "att_01JABCDEF",
			kind: "video",
			name: "clip.mp4",
			mimeType: "video/mp4",
			size: 10_000,
			durationMs: 2_500,
		};

		const { event } = await t.flow.publishEvent({
			roomId: room.id,
			senderId: "u1",
			type: "message.media",
			content: {
				body: "A short clip",
				attachments: [attachment],
			},
		});

		expect(event.content.attachments).toEqual([attachment]);
	});
});

describe("createRoom — input validation", () => {
	it("rejects an empty creatorId", async () => {
		await expect(t.flow.createRoom({ creatorId: "" })).rejects.toBeInstanceOf(
			ChatCoreError,
		);
	});
});

describe("sendMessage — input validation", () => {
	it("rejects a missing roomId", async () => {
		await expect(
			// @ts-expect-error testing invalid input
			t.flow.sendMessage({ senderId: "u1", body: "hi" }),
		).rejects.toBeInstanceOf(MessageWeaveError);
	});

	it("rejects a missing senderId", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		await expect(
			// @ts-expect-error testing invalid input
			t.flow.sendMessage({ roomId: room.id, body: "hi" }),
		).rejects.toBeInstanceOf(MessageWeaveError);
	});

	it("rejects a missing body field", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		await expect(
			// @ts-expect-error testing invalid input
			t.flow.sendMessage({ roomId: room.id, senderId: "u1" }),
		).rejects.toBeInstanceOf(MessageWeaveError);
	});
});

describe("editMessage — input validation", () => {
	it("rejects a missing roomId", async () => {
		await expect(
			// @ts-expect-error testing invalid input
			t.flow.editMessage({ senderId: "u1", messageId: "e1", body: "x" }),
		).rejects.toBeInstanceOf(MessageWeaveError);
	});

	it("rejects a missing senderId", async () => {
		await expect(
			// @ts-expect-error testing invalid input
			t.flow.editMessage({ roomId: "r1", messageId: "e1", body: "x" }),
		).rejects.toBeInstanceOf(MessageWeaveError);
	});

	it("rejects a missing messageId", async () => {
		await expect(
			// @ts-expect-error testing invalid input
			t.flow.editMessage({ roomId: "r1", senderId: "u1", body: "x" }),
		).rejects.toBeInstanceOf(MessageWeaveError);
	});

	it("rejects an empty messageId", async () => {
		await expect(
			t.flow.editMessage({
				roomId: "r1",
				senderId: "u1",
				messageId: "",
				body: "x",
			}),
		).rejects.toBeInstanceOf(MessageWeaveError);
	});
});

describe("deleteMessage — input validation", () => {
	it("rejects a missing roomId", async () => {
		await expect(
			// @ts-expect-error testing invalid input
			t.flow.deleteMessage({ senderId: "u1", messageId: "e1" }),
		).rejects.toBeInstanceOf(MessageWeaveError);
	});

	it("rejects a missing senderId", async () => {
		await expect(
			// @ts-expect-error testing invalid input
			t.flow.deleteMessage({ roomId: "r1", messageId: "e1" }),
		).rejects.toBeInstanceOf(MessageWeaveError);
	});

	it("rejects a missing messageId", async () => {
		await expect(
			// @ts-expect-error testing invalid input
			t.flow.deleteMessage({ roomId: "r1", senderId: "u1" }),
		).rejects.toBeInstanceOf(MessageWeaveError);
	});

	it("rejects an empty messageId", async () => {
		await expect(
			t.flow.deleteMessage({ roomId: "r1", senderId: "u1", messageId: "" }),
		).rejects.toBeInstanceOf(MessageWeaveError);
	});

	it("publishes a tombstone without a reason when reason is omitted", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		const msg = await t.flow.sendMessage({
			roomId: room.id,
			senderId: "u1",
			body: "bye",
		});

		const result = await t.flow.deleteMessage({
			roomId: room.id,
			senderId: "u1",
			messageId: msg.event.id,
		});

		expect(result.event.type).toBe("message.delete");
		expect(result.event.content.tombstone).toBe(true);
		expect(result.event.content.reason).toBeUndefined();
	});
});

describe("publishEvent — additional input validation", () => {
	it("rejects a missing senderId", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		await expect(
			// @ts-expect-error testing invalid input
			t.flow.publishEvent({ roomId: room.id, type: "msg" }),
		).rejects.toBeInstanceOf(MessageWeaveError);
	});

	it("rejects a missing type", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		await expect(
			// @ts-expect-error testing invalid input
			t.flow.publishEvent({ roomId: room.id, senderId: "u1" }),
		).rejects.toBeInstanceOf(MessageWeaveError);
	});

	it("rejects an empty type string", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		await expect(
			t.flow.publishEvent({ roomId: room.id, senderId: "u1", type: "" }),
		).rejects.toBeInstanceOf(MessageWeaveError);
	});
});

describe("getRoomTimeline — default limit", () => {
	it("returns up to defaultLimit events when no options are passed", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		for (let i = 0; i < 3; i++) {
			await t.flow.publishEvent({
				roomId: room.id,
				senderId: "u1",
				type: "msg",
				content: { i },
			});
		}

		const events = await t.flow.getRoomTimeline(room.id);
		expect(events).toHaveLength(3);
		// newest-first
		expect(events[0]!.sequenceId).toBeGreaterThan(events[1]!.sequenceId);
	});

	it("respects a custom defaultLimit set on the instance", async () => {
		const { flow } = getTestInstance({ defaultLimit: 2 });
		const room = await flow.createRoom({ creatorId: "u1" });
		for (let i = 0; i < 5; i++) {
			await flow.publishEvent({
				roomId: room.id,
				senderId: "u1",
				type: "msg",
				content: { i },
			});
		}

		const events = await flow.getRoomTimeline(room.id);
		expect(events).toHaveLength(2);
	});
});

describe("getSyncStream — omitted options", () => {
	it("defaults sinceSequenceId to 0 when called with no arguments, returning all events", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		await t.flow.publishEvent({
			roomId: room.id,
			senderId: "u1",
			type: "msg",
			content: {},
		});
		await t.flow.publishEvent({
			roomId: room.id,
			senderId: "u1",
			type: "msg",
			content: {},
		});

		const result = await t.flow.getSyncStream();
		expect(result.events).toHaveLength(2);
		expect(result.nextToken).toBe(2);
	});
});

describe("flow.options", () => {
	it("exposes the resolved options on the returned instance", () => {
		const { flow } = getTestInstance({
			defaultLimit: 42,
			maxContentBytes: 512,
		});
		expect(flow.options.defaultLimit).toBe(42);
		expect(flow.options.maxContentBytes).toBe(512);
	});

	it("exposes the storage backend on options", () => {
		expect(t.flow.options.storage).toBeDefined();
	});
});

describe("lifecycle hooks", () => {
	it("executes hooks.beforePublish and aborts publish without burning a sequence id if it throws", async () => {
		let beforePublishCalled = false;
		const { flow, db } = getTestInstance({
			hooks: {
				beforePublish: async (input) => {
					beforePublishCalled = true;
					if (input.content?.forbidden === true) {
						throw new Error("moderation rejected");
					}
				},
			},
		});

		const room = await flow.createRoom({ creatorId: "u1" });

		// Rejected publish
		await expect(
			flow.publishEvent({
				roomId: room.id,
				senderId: "u1",
				type: "msg",
				content: { forbidden: true },
			}),
		).rejects.toThrow("moderation rejected");

		expect(beforePublishCalled).toBe(true);
		expect(db.event).toHaveLength(0);
		expect(db.sequence).toHaveLength(0);

		// Allowed publish succeeds with sequenceId 1
		const result = await flow.publishEvent({
			roomId: room.id,
			senderId: "u1",
			type: "msg",
			content: { forbidden: false, text: "allowed" },
		});
		expect(result.sequenceId).toBe(1);
		expect(db.event).toHaveLength(1);
	});

	it("executes hooks.onPublish after successful persistence with the assigned sequence id", async () => {
		const publishedEvents: Array<{ id: string; seq: number; body?: unknown }> =
			[];
		const { flow } = getTestInstance({
			hooks: {
				onPublish: async (event, context) => {
					publishedEvents.push({
						id: event.id,
						seq: event.sequenceId,
						body: context.input.content?.body,
					});
				},
			},
		});

		const room = await flow.createRoom({ creatorId: "u1" });
		const p1 = await flow.publishEvent({
			roomId: room.id,
			senderId: "u1",
			type: "msg",
			content: { body: "first" },
		});
		const p2 = await flow.sendMessage({
			roomId: room.id,
			senderId: "u2",
			body: "second",
		});

		expect(publishedEvents).toHaveLength(2);
		expect(publishedEvents[0]).toEqual({
			id: p1.event.id,
			seq: 1,
			body: "first",
		});
		expect(publishedEvents[1]).toEqual({
			id: p2.event.id,
			seq: 2,
			body: "second",
		});
	});

	it("executes hooks.onRoomCreated after room is created", async () => {
		let createdRoomId: string | null = null;
		let receivedName: unknown = null;

		const { flow } = getTestInstance({
			hooks: {
				onRoomCreated: async (room, input) => {
					createdRoomId = room.id;
					receivedName = input.metadata?.name;
				},
			},
		});

		const room = await flow.createRoom({
			creatorId: "u1",
			metadata: { name: "Announcements" },
		});

		expect(createdRoomId).toBe(room.id);
		expect(receivedName).toBe("Announcements");
	});
});

describe("dynamic event subscriptions (flow.onEvent)", () => {
	it("receives published events and supports unsubscribe", async () => {
		const eventsA: string[] = [];
		const eventsB: string[] = [];

		const unsubscribeA = t.flow.onEvent((event) => {
			eventsA.push(event.id);
		});
		const unsubscribeB = t.flow.onEvent((event) => {
			eventsB.push(event.id);
		});

		const room = await t.flow.createRoom({ creatorId: "u1" });
		const m1 = await t.flow.sendMessage({
			roomId: room.id,
			senderId: "u1",
			body: "hello",
		});

		expect(eventsA).toEqual([m1.event.id]);
		expect(eventsB).toEqual([m1.event.id]);

		// Unsubscribe A
		unsubscribeA();

		const m2 = await t.flow.sendMessage({
			roomId: room.id,
			senderId: "u1",
			body: "world",
		});

		expect(eventsA).toEqual([m1.event.id]);
		expect(eventsB).toEqual([m1.event.id, m2.event.id]);

		// Unsubscribe B
		unsubscribeB();

		await t.flow.sendMessage({
			roomId: room.id,
			senderId: "u1",
			body: "ignored",
		});

		expect(eventsB).toEqual([m1.event.id, m2.event.id]);
	});

	it("executes async listeners concurrently with Promise.allSettled and isolates listener errors", async () => {
		const events: string[] = [];

		t.flow.onEvent(async (event) => {
			events.push(`start_1_${event.sequenceId}`);
			throw new Error("listener 1 failed");
		});

		t.flow.onEvent(async (event) => {
			events.push(`start_2_${event.sequenceId}`);
			await new Promise((resolve) => setTimeout(resolve, 5));
			events.push(`end_2_${event.sequenceId}`);
		});

		const room = await t.flow.createRoom({ creatorId: "u1" });
		const result = await t.flow.sendMessage({
			roomId: room.id,
			senderId: "u1",
			body: "test error isolation",
		});

		// Event successfully published despite Listener 1 throwing
		expect(result.sequenceId).toBe(1);
		expect(events).toEqual(["start_1_1", "start_2_1", "end_2_1"]);
	});

	it("handles publishing safely with zero registered listeners", async () => {
		const room = await t.flow.createRoom({ creatorId: "u1" });
		const result = await t.flow.sendMessage({
			roomId: room.id,
			senderId: "u1",
			body: "no listeners",
		});
		expect(result.sequenceId).toBe(1);
	});
});
