import { boolean, index, integer, pgTable, serial, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
