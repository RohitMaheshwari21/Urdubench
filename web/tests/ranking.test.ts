import { describe, expect, it } from "vitest";
import { bradleyTerry, elo, standings, type Outcome } from "@/lib/ranking";

const v = (modelA: string, modelB: string, winner: Outcome["winner"]): Outcome => ({ modelA, modelB, winner });
const times = (n: number, o: Outcome) => Array.from({ length: n }, () => o);

describe("elo", () => {
  it("moves the winner up and the loser down by the same amount", () => {
    const r = elo([v("x", "y", "a")]);
    expect(r.x).toBeCloseTo(1016);
    expect(r.y).toBeCloseTo(984);
  });
  it("leaves equal ratings unchanged on a tie", () => {
    const r = elo([v("x", "y", "tie")]);
    expect(r.x).toBe(1000);
    expect(r.y).toBe(1000);
  });
});

describe("bradleyTerry", () => {
  it("returns nothing for no votes", () => {
    expect(bradleyTerry([])).toEqual({});
  });

  it("is symmetric for balanced results and centred on 1000", () => {
    const r = bradleyTerry([v("x", "y", "a"), v("x", "y", "b")]);
    expect(r.x).toBeCloseTo(1000, 6);
    expect(r.y).toBeCloseTo(1000, 6);
  });

  it("recovers the win probability for a 3:1 record (with the prior tie)", () => {
    // 3 wins + 0.5 prior vs 1 win + 0.5 prior over 5 games: p = 3.5/5 = 0.7
    const r = bradleyTerry([...times(3, v("x", "y", "a")), v("x", "y", "b")]);
    const p = 1 / (1 + 10 ** ((r.y - r.x) / 400));
    expect(p).toBeCloseTo(0.7, 4);
  });

  it("stays finite when a model wins every game", () => {
    const r = bradleyTerry(times(20, v("x", "y", "a")));
    expect(Number.isFinite(r.x)).toBe(true);
    expect(r.x).toBeGreaterThan(r.y);
  });

  it("is transitive and order-independent", () => {
    const votes = [...times(4, v("x", "y", "a")), ...times(4, v("y", "z", "a")), ...times(2, v("x", "z", "a"))];
    const r1 = bradleyTerry(votes);
    const r2 = bradleyTerry([...votes].reverse());
    expect(r1.x).toBeGreaterThan(r1.y);
    expect(r1.y).toBeGreaterThan(r1.z);
    for (const m of ["x", "y", "z"]) expect(r1[m]).toBeCloseTo(r2[m], 6);
  });

  it("treats both-bad like a tie", () => {
    expect(bradleyTerry([v("x", "y", "both_bad")])).toEqual(bradleyTerry([v("x", "y", "tie")]));
  });
});

describe("standings", () => {
  it("counts wins, ties and losses and sorts by rating", () => {
    const s = standings([v("x", "y", "a"), v("y", "x", "b"), v("x", "y", "tie"), v("z", "x", "a")]);
    const x = s.find((r) => r.model === "x")!;
    expect(x).toMatchObject({ games: 4, wins: 2, ties: 1, losses: 1 });
    expect(s.map((r) => r.bt)).toEqual([...s.map((r) => r.bt)].sort((a, b) => b - a));
    expect(s.reduce((n, r) => n + r.games, 0)).toBe(8);
  });
});
