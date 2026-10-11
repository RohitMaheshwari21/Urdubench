"use client";

import { useId, useMemo, useState } from "react";
import { DEFAULT_FILTERS, categoriesOf, filterUnits, type Filters, type Unit } from "@/lib/explorer";
import { ItemCard } from "./item-card";

const PAGE = 15;

export function ExplorerList({ units }: { units: Unit[] }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [visible, setVisible] = useState(PAGE);
  const uid = useId();
  const categories = useMemo(() => categoriesOf(units), [units]);
  const matches = useMemo(() => filterUnits(units, filters), [units, filters]);

  function update(patch: Partial<Filters>) {
    setFilters((f) => ({ ...f, ...patch }));
    setVisible(PAGE);
  }

  const field = "mt-1 block w-full rounded-md border border-line bg-background px-3 py-2 text-sm";
  return (
    <div>
      <form
        onSubmit={(e) => e.preventDefault()}
        className="grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Filter items"
      >
        <div>
          <label htmlFor={`${uid}-q`} className="text-sm font-medium">
            Search
          </label>
          <input
            id={`${uid}-q`}
            type="search"
            value={filters.query}
            onChange={(e) => update({ query: e.target.value })}
            placeholder="word or id"
            className={field}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-c`} className="text-sm font-medium">
            Category
          </label>
          <select id={`${uid}-c`} value={filters.category} onChange={(e) => update({ category: e.target.value })} className={field}>
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${uid}-d`} className="text-sm font-medium">
            Difficulty (author estimate)
          </label>
          <select id={`${uid}-d`} value={filters.difficulty} onChange={(e) => update({ difficulty: e.target.value })} className={field}>
            <option value="all">Any</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div>
          <label htmlFor={`${uid}-o`} className="text-sm font-medium">
            Model results
          </label>
          <select
            id={`${uid}-o`}
            value={filters.outcome}
            onChange={(e) => update({ outcome: e.target.value as Filters["outcome"] })}
            className={field}
          >
            <option value="all">All items</option>
            <option value="some-wrong">At least one model got it wrong</option>
            <option value="all-wrong">Every model got it wrong</option>
          </select>
        </div>
      </form>

      <p className="mt-3 text-sm text-muted" aria-live="polite">
        Showing {Math.min(visible, matches.length)} of {matches.length} matching items ({units.length} in total).
      </p>

      <div className="mt-3 space-y-4">
        {matches.slice(0, visible).map((u) => (
          <ItemCard key={u.id} unit={u} />
        ))}
      </div>

      {visible < matches.length && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE)}
          className="mt-4 rounded-md border border-line bg-surface px-4 py-2 text-sm hover:border-accent"
        >
          Show more
        </button>
      )}
      {matches.length === 0 && <p className="mt-4 text-muted">No items match these filters.</p>}
    </div>
  );
}
