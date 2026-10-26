import { createInsertSchema } from "drizzle-zod";
import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export type StoredTranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

export type StoredTranslation = {
  language: string;
  languageCode: string;
  transcript: string;
  segments: StoredTranscriptSegment[];
  createdAt: string;
};

export const projectsTable = pgTable(
  "transcription_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id").notNull(),
    title: text("title").notNull(),
    sourceType: text("source_type", { enum: ["upload", "youtube"] }).notNull(),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url"),
    status: text("status", { enum: ["completed"] })
      .notNull()
      .default("completed"),
    language: text("language").notNull(),
    durationSeconds: real("duration_seconds"),
    transcript: text("transcript").notNull(),
    segments: jsonb("segments")
      .$type<StoredTranscriptSegment[]>()
      .notNull()
      .default([]),
    summary: text("summary"),
    wordCount: integer("word_count").notNull().default(0),
    translations: jsonb("translations")
      .$type<StoredTranslation[]>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("transcription_projects_owner_created_idx").on(table.ownerId, table.createdAt)],
);

export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
