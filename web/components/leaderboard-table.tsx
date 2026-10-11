"use client";

import { useId, useMemo, useState } from "react";
import {
  columnsFor,
  defaultSort,
  filterRows,
  provider,
  sortRows,
  type Row,
  type SortDir,
  type View,
} from "@/lib/leaderboard";
import { TASKS } from "@/lib/tasks";

const VIEWS: { id: View; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "T1", label: TASKS.T1.short },
  { id: "T2", label: TASKS.T2.short },
  { id: "T3", label: TASKS.T3.short },
  { id: "T4", label: TASKS.T4.short },
];

export function LeaderboardTable({ rows }: { rows: Row[] }) {
  const [view, setView] = useState<View>("overview");
  const [sort, setSort] = useState(() => defaultSort("overview"));
  const [onlyComplete, setOnlyComplete] = useState(false);
  const checkboxId = useId();

  const columns = useMemo(() => columnsFor(view), [view]);
  const activeColumn = columns.find((c) => c.key === sort.key) ?? columns[0];
  const shown = useMemo(
    () => sortRows(filterRows(rows, { onlyComplete }), activeColumn, sort.dir),
    [rows, onlyComplete, activeColumn, sort.dir],
  );

  function chooseView(next: View) {
    setView(next);
    setSort(defaultSort(next));
  }

  function toggleSort(key: string, higherIsBetter: boolean) {
    setSort((prev) => {
      const dir: SortDir = prev.key === key ? (prev.dir === "desc" ? "asc" : "desc") : higherIsBetter ? "desc" : "asc";
      return { key, dir };
    });
  }

  const info = view === "overview" ? null : TASKS[view];

  return (
    <div>
      <div role="group" aria-label="Choose what to compare" className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={view === v.id}
            onClick={() => chooseView(v.id)}
            className={`rounded-full border px-4 py-2 text-sm ${
              view === v.id
                ? "border-accent bg-accent font-semibold text-white"
                : "border-line bg-surface text-foreground hover:border-accent"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {info && (
        <p className="mt-3 text-sm text-muted">
          <strong className="text-foreground">{info.name}.</strong> {info.description} Metric: {info.metric}.
        </p>
      )}

      <div className="mt-4 flex items-center gap-2 text-sm">
        <input
          id={checkboxId}
          type="checkbox"
          checked={onlyComplete}
          onChange={(e) => setOnlyComplete(e.target.checked)}
          className="h-4 w-4 accent-[var(--accent)]"
        />
        <label htmlFor={checkboxId}>Only models that finished every item</label>
      </div>

      <div
        role="region"
        aria-label="Leaderboard table; scrolls sideways on narrow screens"
        tabIndex={0}
        className="mt-3 overflow-x-auto rounded-lg border border-line"
      >
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <caption className="sr-only">
            Model scores on the Urdu-Bench dev split. Use the column buttons to sort.
          </caption>
          <thead className="bg-surface">
            <tr>
              <th scope="col" className="px-3 py-3 text-left font-semibold">
                Model
              </th>
              {columns.map((c) => {
                const active = c.key === activeColumn.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                    className="px-3 py-3 text-left font-semibold"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key, c.higherIsBetter)}
                      title={c.hint}
                      className="inline-flex items-center gap-1 text-left font-semibold hover:text-accent"
                    >
                      {c.label}
                      <span aria-hidden="true" className="text-xs text-muted">
                        {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.model} className="border-t border-line">
                <th scope="row" className="px-3 py-3 text-left font-medium">
                  {r.label}
                  <span className="block text-xs font-normal text-muted">
                    via {provider(r.model)}
                    {!r.entry.complete && " · incomplete run"}
                  </span>
                </th>
                {columns.map((c) => (
                  <td key={c.key} className="whitespace-nowrap px-3 py-3 tabular-nums">
                    {c.display(r)}
                  </td>
                ))}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-6 text-center text-muted">
                  No models to show.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted" aria-live="polite">
        {shown.length} model{shown.length === 1 ? "" : "s"} shown. Brackets are 95% bootstrap intervals; with only
        30 to 90 items per task they are wide.
      </p>
    </div>
  );
}
