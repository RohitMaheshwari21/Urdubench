import { boolean, index, integer, pgTable, serial, text, timestamp, uuid, vector } from "drizzle-orm/pg-core";

// Privacy: no names, emails, IPs or prompt text. A user is a random anonymous id from a cookie.

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const votes = pgTable(
  "votes",
  {
    id: serial("id").primaryKey(),
    // one vote per battle; a battle belongs to one session and one model pair
    battleId: uuid("battle_id").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    modelA: text("model_a").notNull(),
    modelB: text("model_b").notNull(),
    winner: text("winner", { enum: ["a", "b", "tie", "both_bad"] }).notNull(),
    promptChars: integer("prompt_chars").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("votes_created_at_idx").on(t.createdAt)],
);

// Quiz questions are read from the public dev split JSON, not stored here.
export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: serial("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: text("item_id").notNull(),
    correct: boolean("correct").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("quiz_attempts_user_idx").on(t.userId)],
);

// Phase 7: Urdu Wikipedia chunks (CC BY-SA 4.0) for /api/ask, loaded offline by scripts/load-index.mjs.
// 768 dims = gemini-embedding-001 with outputDimensionality 768, L2-normalized (same as benchmark/urdubench/rag).
export const docChunks = pgTable(
  "doc_chunks",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    section: text("section").notNull(),
    url: text("url").notNull(),
    text: text("text").notNull(),
    embedding: vector("embedding", { dimensions: 768 }).notNull(),
  },
  (t) => [index("doc_chunks_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops"))],
);

// Phase 8: WhatsApp bot state. The id is a salted SHA-256 of the phone number; the number itself and
// message text are never stored. STOP deletes the row.
export const waUsers = pgTable("wa_users", {
  id: text("id").primaryKey(),
  language: text("language", { enum: ["ur", "roman", "en"] }).notNull().default("roman"),
  currentItem: text("current_item"),
  answered: integer("answered").notNull().default(0),
  correct: integer("correct").notNull().default(0),
  streak: integer("streak").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
