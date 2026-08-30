import { describe, expect, it } from "vitest";
import type { FlowEvent } from "../types";
import { projectTimeline } from "./project";

/** Build a minimal FlowEvent for use in unit tests. */
function makeEvent(overrides: Partial<FlowEvent> & { id: string }): FlowEvent {
	return {
		roomId: "room_1",
		senderId: "u1",
		type: "message.text",
		stateKey: null,
		content: { body: "hello" },
		timestamp: Date.now(),
		sequenceId: 1,
		...overrides,
	};
}

describe("projectTimeline — edge cases", () => {
	it("returns an empty array for empty input", () => {
		expect(projectTimeline([])).toEqual([]);
	});

	it("projects a single plain message correctly", () => {
		const event = makeEvent({ id: "e1", sequenceId: 1 });
		const result = projectTimeline([event]);

		expect(result).toHaveLength(1);
		expect(result[0]!.id).toBe("e1");
		expect(result[0]!.body).toBe("hello");
		expect(result[0]!.isEdited).toBe(false);
		expect(result[0]!.isDeleted).toBe(false);
		expect(result[0]!.editCount).toBe(0);
		expect(result[0]!.editedAt).toBeNull();
		expect(result[0]!.deletedAt).toBeNull();
		expect(result[0]!.deleteReason).toBeNull();
		expect(result[0]!.lastEditSequenceId).toBeNull();
		expect(result[0]!.rawEvents).toHaveLength(1);
	});

	it("handles descending-order input — sorts internally before projecting", () => {
		const e1 = makeEvent({
			id: "e1",
			sequenceId: 1,
			content: { body: "original" },
		});
		const e2 = makeEvent({
			id: "e2",
			sequenceId: 2,
			type: "message.edit",
			content: { targetMessageId: "e1", body: "edited", editedAt: 2000 },
		});
		// feed newest-first (as getRoomTimeline returns)
		const result = projectTimeline([e2, e1]);

		expect(result).toHaveLength(1);
		expect(result[0]!.body).toBe("edited");
		expect(result[0]!.isEdited).toBe(true);
	});

	it("silently ignores an orphan edit event (target not in stream)", () => {
		const edit = makeEvent({
			id: "e_edit",
			sequenceId: 2,
			type: "message.edit",
			content: {
				targetMessageId: "nonexistent",
				body: "new body",
				editedAt: 2000,
			},
		});
		const result = projectTimeline([edit]);

		// The orphan edit should not create a root entry
		expect(result).toHaveLength(0);
	});

	it("silently ignores an orphan delete event (target not in stream)", () => {
		const del = makeEvent({
			id: "e_del",
			sequenceId: 2,
			type: "message.delete",
			content: {
				targetMessageId: "nonexistent",
				tombstone: true,
				deletedAt: 2000,
			},
		});
		const result = projectTimeline([del]);

		expect(result).toHaveLength(0);
	});

	it("resolves edit target via parentEventIds when targetMessageId is absent", () => {
		const e1 = makeEvent({
			id: "e1",
			sequenceId: 1,
			content: { body: "original" },
		});
		// no targetMessageId — only parentEventIds
		const edit = makeEvent({
			id: "e2",
			sequenceId: 2,
			type: "message.edit",
			// parentEventIds is not on FlowEvent type but projectTimeline reads it
			// via the cast — simulate by spreading onto the object
			content: { body: "via parentEventIds", editedAt: 2000 },
		}) as FlowEvent & { parentEventIds: string[] };
		edit.parentEventIds = ["e1"];

		const result = projectTimeline([e1, edit as unknown as FlowEvent]);

		expect(result[0]!.body).toBe("via parentEventIds");
		expect(result[0]!.isEdited).toBe(true);
	});

	it("ignores state events — they are not projected as messages", () => {
		const state = makeEvent({
			id: "s1",
			sequenceId: 1,
			type: "room.member",
			stateKey: "u1",
			content: { membership: "join" },
		});
		const msg = makeEvent({ id: "e1", sequenceId: 2 });
		const result = projectTimeline([state, msg]);

		expect(result).toHaveLength(1);
		expect(result[0]!.id).toBe("e1");
	});

	it("projects non-message.text events (e.g. room.member with null stateKey) as root entries", () => {
		// An event with a non-message.text type but stateKey === null is treated as a timeline entry
		const event = makeEvent({
			id: "e1",
			sequenceId: 1,
			type: "room.custom",
			content: {},
		});
		const result = projectTimeline([event]);

		expect(result).toHaveLength(1);
		expect(result[0]!.type).toBe("room.custom");
		expect(result[0]!.body).toBe(""); // no body field in content → ""
	});

	it("accumulates multiple edits on the same message", () => {
		const original = makeEvent({
			id: "e1",
			sequenceId: 1,
			content: { body: "v1" },
		});
		const edit1 = makeEvent({
			id: "e2",
			sequenceId: 2,
			type: "message.edit",
			content: { targetMessageId: "e1", body: "v2", editedAt: 200 },
		});
		const edit2 = makeEvent({
			id: "e3",
			sequenceId: 3,
			type: "message.edit",
			content: { targetMessageId: "e1", body: "v3", editedAt: 300 },
		});

		const result = projectTimeline([original, edit1, edit2]);

		expect(result).toHaveLength(1);
		expect(result[0]!.body).toBe("v3");
		expect(result[0]!.editCount).toBe(2);
		expect(result[0]!.lastEditSequenceId).toBe(3);
		expect(result[0]!.rawEvents).toHaveLength(3);
	});

	it("uses event.timestamp as editedAt fallback when content.editedAt is absent", () => {
		const ts = 123456789;
		const original = makeEvent({
			id: "e1",
			sequenceId: 1,
			content: { body: "v1" },
		});
		const edit = makeEvent({
			id: "e2",
			sequenceId: 2,
			type: "message.edit",
			timestamp: ts,
			content: { targetMessageId: "e1", body: "v2" }, // no editedAt
		});

		const result = projectTimeline([original, edit]);

		expect(result[0]!.editedAt).toBe(ts);
	});

	it("uses event.timestamp as deletedAt fallback when content.deletedAt is absent", () => {
		const ts = 987654321;
		const original = makeEvent({ id: "e1", sequenceId: 1 });
		const del = makeEvent({
			id: "e2",
			sequenceId: 2,
			type: "message.delete",
			timestamp: ts,
			content: { targetMessageId: "e1", tombstone: true }, // no deletedAt
		});

		const result = projectTimeline([original, del]);

		expect(result[0]!.deletedAt).toBe(ts);
	});

	it("deleteReason is null when content.reason is absent", () => {
		const original = makeEvent({ id: "e1", sequenceId: 1 });
		const del = makeEvent({
			id: "e2",
			sequenceId: 2,
			type: "message.delete",
			content: { targetMessageId: "e1", tombstone: true },
		});

		const [projected] = projectTimeline([original, del]);
		expect(projected!.deleteReason).toBeNull();
	});

	it("includeDeleted: true (default) keeps deleted messages in output", () => {
		const original = makeEvent({ id: "e1", sequenceId: 1 });
		const del = makeEvent({
			id: "e2",
			sequenceId: 2,
			type: "message.delete",
			content: { targetMessageId: "e1", tombstone: true },
		});

		const result = projectTimeline([original, del]);
		expect(result).toHaveLength(1);
		expect(result[0]!.isDeleted).toBe(true);
	});

	it("includeDeleted: false omits deleted messages", () => {
		const msg1 = makeEvent({ id: "e1", sequenceId: 1 });
		const msg2 = makeEvent({ id: "e2", sequenceId: 2 });
		const del = makeEvent({
			id: "e3",
			sequenceId: 3,
			type: "message.delete",
			content: { targetMessageId: "e1", tombstone: true },
		});

		const result = projectTimeline([msg1, msg2, del], {
			includeDeleted: false,
		});
		expect(result).toHaveLength(1);
		expect(result[0]!.id).toBe("e2");
	});

	it("preserves insertion order in output (ordered by original sequenceId)", () => {
		const e3 = makeEvent({
			id: "e3",
			sequenceId: 3,
			content: { body: "third" },
		});
		const e1 = makeEvent({
			id: "e1",
			sequenceId: 1,
			content: { body: "first" },
		});
		const e2 = makeEvent({
			id: "e2",
			sequenceId: 2,
			content: { body: "second" },
		});

		const result = projectTimeline([e3, e1, e2]);

		expect(result.map((m) => m.id)).toEqual(["e1", "e2", "e3"]);
	});

	it("edit does not affect body of the wrong message", () => {
		const e1 = makeEvent({
			id: "e1",
			sequenceId: 1,
			content: { body: "msg1" },
		});
		const e2 = makeEvent({
			id: "e2",
			sequenceId: 2,
			content: { body: "msg2" },
		});
		const edit = makeEvent({
			id: "e3",
			sequenceId: 3,
			type: "message.edit",
			content: { targetMessageId: "e1", body: "msg1 edited", editedAt: 3000 },
		});

		const result = projectTimeline([e1, e2, edit]);

		expect(result).toHaveLength(2);
		expect(result[0]!.body).toBe("msg1 edited");
		expect(result[1]!.body).toBe("msg2");
		expect(result[1]!.isEdited).toBe(false);
	});
});
