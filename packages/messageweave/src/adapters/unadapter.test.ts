import { memoryAdapter } from "unadapter/memory";
import { describe, expect, it } from "vitest";
import { createChatCore } from "../chatcore";
import { createUnadapterStorage } from "./unadapter";

describe("createUnadapterStorage", () => {
	it("adapts an Unadapter database factory to ChatCoreStorage", async () => {
		const database: Record<string, Record<string, unknown>[]> = {
			room: [],
			event: [],
			eventEdge: [],
			roomState: [],
			sequence: [],
		};
		const storage = createUnadapterStorage(memoryAdapter(database));
		const flow = createChatCore({ storage });

		const room = await flow.createRoom({ creatorId: "u1" });
		const result = await flow.sendMessage({
			roomId: room.id,
			senderId: "u1",
			body: "hello",
		});

		expect(result.sequenceId).toBe(1);
		expect(result.event.content).toEqual({ body: "hello" });
		expect(await flow.getRoomTimeline(room.id)).toEqual([result.event]);
	});
});
