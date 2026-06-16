import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// Public message board: anyone at the reunion can post a note for the family.
export const messages = pgTable("messages", {
  id: serial().primaryKey(),
  name: text().notNull().default("Anonymous"),
  body: text().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Suggestion box: ideas for this year or next, read by the reunion committee.
export const suggestions = pgTable("suggestions", {
  id: serial().primaryKey(),
  body: text().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
