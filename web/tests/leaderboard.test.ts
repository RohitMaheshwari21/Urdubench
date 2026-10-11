import { describe, expect, it } from "vitest";
import { analysis, leaderboard } from "@/lib/data";
import {
  buildRows,
  columnsFor,
  defaultSort,
  filterRows,
  headlines,
  pct,
  shortModel,
  signed2,
  sortRows,
  unusableShare,
  type Row,
} from "@/lib/leaderboard";

const rows = buildRows(leaderboard, analysis);

function fake(label: string, t3: number | null, complete = true): Row {
  const base = rows[0];
  return {
    ...base,
    model: label,
    label,
    entry: { ...base.entry, model: label, complete },
    cells: t3 === null ? {} : { T3: { n: 30, mean: t3, ci95: [t3 - 0.1, t3 + 0.1] } },
  };
}

describe("formatting", () => {
  it("formats numbers", () => {
    expect(signed2(0.4333)).toBe("+0.43");
    expect(signed2(-0.05)).toBe("-0.05");
    expect(signed2(0)).toBe("0.00");
    expect(pct(0.1)).toBe("10%");
    expect(shortModel("groq/openai/gpt-oss-20b")).toBe("openai/gpt-oss-20b");
  });
});

describe("sorting and filtering", () => {
  const t3 = columnsFor("overview").find((c) => c.key === "T3.mean")!;

  it("sorts descending and ascending, with missing values always last", () => {
    const data = [fake("b", 0.5), fake("a", null), fake("c", 0.9), fake("d", 0.5)];
    expect(sortRows(data, t3, "desc").map((r) => r.label)).toEqual(["c", "b", "d", "a"]);
    expect(sortRows(data, t3, "asc").map((r) => r.label)).toEqual(["b", "d", "c", "a"]);
  });

  it("does not mutate its input", () => {
    const data = [fake("b", 0.5), fake("c", 0.9)];
    sortRows(data, t3, "desc");
    expect(data.map((r) => r.label)).toEqual(["b", "c"]);
  });

  it("filters to complete runs only", () => {
    const data = [fake("a", 0.5, true), fake("b", 0.6, false)];
    expect(filterRows(data, { onlyComplete: true }).map((r) => r.label)).toEqual(["a"]);
    expect(filterRows(data, { onlyComplete: false })).toHaveLength(2);
  });

  it("uses a sensible default sort per view", () => {
    expect(defaultSort("overview")).toEqual({ key: "T3.mean", dir: "desc" });
    expect(defaultSort("T4")).toEqual({ key: "T4.ur", dir: "desc" });
  });
});

describe("columns on real data", () => {
  it("every view renders every row without throwing", () => {
    for (const view of ["overview", "T1", "T2", "T3", "T4"] as const) {
      for (const col of columnsFor(view)) {
        for (const r of rows) {
          expect(typeof col.display(r)).toBe("string");
          const v = col.value(r);
          expect(v === null || Number.isFinite(v)).toBe(true);
        }
      }
    }
  });

  it("shows the Urdu gap with its interval for the parity view", () => {
    const gap = columnsFor("T4").find((c) => c.key === "T4.gap")!;
    const text = rows.map((r) => gap.display(r));
    expect(text.some((t) => /^[+-]?\d\.\d\d \[/.test(t))).toBe(true);
    expect(gap.higherIsBetter).toBe(false);
  });

  it("computes the unusable-reply share from per-task rates", () => {
    const entry = structuredClone(rows[0].entry);
    entry.tasks = {
      T1: { n: 10, em: 0, f1: 0, empty_rate: 0.2 },
      T3: { n: 10, accuracy: 0, invalid_rate: 0 },
    };
    expect(unusableShare(entry)).toBeCloseTo(0.1);
  });

  it("derives headlines from the data", () => {
    const h = headlines(rows);
    expect(h.map((x) => x.task)).toEqual(expect.arrayContaining(["T1", "T2", "T3"]));
    expect(h.every((x) => x.model.length > 0 && x.value.length > 0)).toBe(true);
  });
});
