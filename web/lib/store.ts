import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import { quizAttempts, users, votes } from "@/drizzle/schema";

export type Winner = "a" | "b" | "tie" | "both_bad";

export type VoteRow = {
  battleId: string;
  userId: string;
  modelA: string;
  modelB: string;
  winner: Winner;
  promptChars: number;
};

export type QuizRow = { userId: string; itemId: string; correct: boolean };

/** Durable storage for votes and quiz attempts. Neon in production, memory in tests. */
export interface Store {
  /** Returns false if this battle already has a vote. */
  recordVote(v: VoteRow): Promise<boolean>;
  recordQuizAttempt(a: QuizRow): Promise<void>;
  /** Removes the anonymous user and everything linked to it. */
  deleteUser(userId: string): Promise<void>;
}

export class MemoryStore implements Store {
  votes: VoteRow[] = [];
  attempts: QuizRow[] = [];

  async recordVote(v: VoteRow) {
    if (this.votes.some((x) => x.battleId === v.battleId)) return false;
    this.votes.push(v);
    return true;
  }

  async recordQuizAttempt(a: QuizRow) {
    this.attempts.push(a);
  }

  async deleteUser(userId: string) {
    this.votes = this.votes.filter((v) => v.userId !== userId);
    this.attempts = this.attempts.filter((a) => a.userId !== userId);
  }
}

export class NeonStore implements Store {
  private db;
  constructor(url: string) {
    this.db = drizzle({ client: neon(url) });
  }

  private async ensureUser(id: string) {
    await this.db.insert(users).values({ id }).onConflictDoNothing();
  }

  async recordVote(v: VoteRow) {
    await this.ensureUser(v.userId);
    const rows = await this.db.insert(votes).values(v).onConflictDoNothing().returning({ id: votes.id });
    return rows.length > 0;
  }

  async recordQuizAttempt(a: QuizRow) {
    await this.ensureUser(a.userId);
    await this.db.insert(quizAttempts).values(a);
  }

  async deleteUser(userId: string) {
    // votes and quiz attempts go with it (on delete cascade)
    await this.db.delete(users).where(eq(users.id, userId));
  }
}
