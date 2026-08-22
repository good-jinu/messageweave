import { describe, expect, it } from "vitest";
import { getMessageWeaveTables, messageWeaveTables } from "./schema";

describe("messageWeaveTables", () => {
	it("describes every model used by the storage engine", () => {
		expect(Object.keys(messageWeaveTables)).toEqual([
			"room",
			"event",
			"eventEdge",
			"roomState",
			"sequence",
		]);
		expect(messageWeaveTables.event!.fields.sequenceId).toMatchObject({
			type: "number",
			bigint: true,
			unique: true,
		});
		expect(getMessageWeaveTables()).toEqual(messageWeaveTables);
		expect(getMessageWeaveTables()).not.toBe(messageWeaveTables);
	});

	it("returns a copy that adapters can normalize without mutating the source", () => {
		const tables = getMessageWeaveTables();
		tables.event!.fields.roomId!.references = undefined;

		expect(messageWeaveTables.event!.fields.roomId!.references).toEqual({
			model: "room",
			field: "id",
			onDelete: "cascade",
		});
	});
});
