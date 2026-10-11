import { describe, expect, it } from "vitest";
import { getItems } from "@/lib/data";
import {
  DEFAULT_FILTERS,
  categoriesOf,
  filterUnits,
  isCorrect,
  keyText,
  textDirection,
  toUnits,
} from "@/lib/explorer";

describe("explorer logic", () => {
  it("groups T4 items into Urdu+English pairs, Urdu first", () => {
    const units = toUnits(getItems("T4"));
    expect(units).toHaveLength(getItems("T4").items.length / 2);
    for (const u of units) {
      expect(u.items.map((i) => i.language)).toEqual(["ur", "en"]);
      expect(u.items[0].pair_id).toBe(u.items[1].pair_id);
    }
    expect(toUnits(getItems("T3"))).toHaveLength(30);
  });

  it("judges correctness per task", () => {
    expect(isCorrect("T1", { em: 1, f1: 1 })).toBe(true);
    expect(isCorrect("T1", { em: 0, f1: 0.9 })).toBe(false);
    expect(isCorrect("T3", { correct: true })).toBe(true);
    expect(isCorrect("T3", { correct: false, invalid: true })).toBe(false);
  });

  it("sets text direction for each script", () => {
    expect(textDirection("ur")).toEqual({ dir: "rtl", lang: "ur" });
    expect(textDirection("roman-ur")).toEqual({ dir: "ltr", lang: "ur-Latn" });
    expect(textDirection("en")).toEqual({ dir: "ltr", lang: "en" });
  });

  it("filters by category, difficulty, outcome and text", () => {
    const units = toUnits(getItems("T3"));
    const cats = categoriesOf(units);
    expect(cats.length).toBeGreaterThan(3);
    const one = filterUnits(units, { ...DEFAULT_FILTERS, category: cats[0] });
    expect(one.length).toBeGreaterThan(0);
    expect(one.every((u) => u.items[0].category === cats[0])).toBe(true);
    const allWrong = filterUnits(units, { ...DEFAULT_FILTERS, outcome: "all-wrong" });
    const someWrong = filterUnits(units, { ...DEFAULT_FILTERS, outcome: "some-wrong" });
    expect(someWrong.length).toBeGreaterThanOrEqual(allWrong.length);
    expect(filterUnits(units, { ...DEFAULT_FILTERS, query: "t3-001" })).toHaveLength(1);
    expect(filterUnits(units, { ...DEFAULT_FILTERS, query: "zzzz-no-match" })).toHaveLength(0);
    expect(filterUnits(units, { ...DEFAULT_FILTERS, difficulty: "hard" }).every((u) => u.items[0].difficulty === "hard")).toBe(true);
  });

  it("formats the answer key", () => {
    const mcq = getItems("T3").items[0];
    expect(keyText(mcq)).toMatch(/^[A-D]\. /);
    const t1 = getItems("T1").items[0];
    expect(keyText(t1).length).toBeGreaterThan(0);
    expect(keyText(getItems("T2").items[0])).toMatch(/positive|negative|neutral/);
  });
});
