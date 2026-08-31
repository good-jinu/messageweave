import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	username: text("username").notNull().unique(),
	displayName: text("displayName").notNull(),
	createdAt: integer("createdAt").notNull(),
});
