import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const room = sqliteTable("room", {
	id: text("id").primaryKey(),
	creatorId: text("creatorId").notNull(),
	createdAt: integer("createdAt").notNull(),
	metadata: text("metadata", { mode: "json" }).notNull(),
});

export const event = sqliteTable("event", {
	id: text("id").primaryKey(),
	roomId: text("roomId")
		.notNull()
		.references(() => room.id, { onDelete: "cascade" }),
	senderId: text("senderId").notNull(),
	type: text("type").notNull(),
	stateKey: text("stateKey"),
	content: text("content", { mode: "json" }).notNull(),
	timestamp: integer("timestamp").notNull(),
	sequenceId: integer("sequenceId").notNull().unique(),
});

export const eventEdge = sqliteTable("eventEdge", {
	id: text("id").primaryKey(),
	eventId: text("eventId")
		.notNull()
		.references(() => event.id, { onDelete: "cascade" }),
	parentEventId: text("parentEventId").notNull(),
});

export const roomState = sqliteTable("roomState", {
	id: text("id").primaryKey(),
	roomId: text("roomId")
		.notNull()
		.references(() => room.id, { onDelete: "cascade" }),
	eventType: text("eventType").notNull(),
	stateKey: text("stateKey").notNull(),
	eventId: text("eventId")
		.notNull()
		.references(() => event.id, { onDelete: "cascade" }),
});

export const sequence = sqliteTable("sequence", {
	id: text("id").primaryKey(),
	name: text("name").notNull().unique(),
	value: integer("value").notNull(),
});
