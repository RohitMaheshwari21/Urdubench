import Link from "next/link";
import type { ArenaT } from "@/lib/schemas";

/** Arena ranking from human votes. Static: regenerated offline by scripts/export-ranking.mjs. */
export function ArenaStandings({ arena }: { arena: ArenaT }) {
  if (arena.n_votes === 0)
    return (
      <p className="text-sm text-muted">
        No votes yet.{" "}
        <Link href="/arena" className="text-accent underline">
          Try the arena
        </Link>{" "}
        and the ranking will appear here.
      </p>
    );
  return (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Arena ranking table">
      <table className="w-full text-sm tabular-nums">
        <caption className="sr-only">
          Arena ranking from {arena.n_votes} votes, sorted by Bradley-Terry rating
        </caption>
        <thead>
          <tr className="text-left text-muted">
            <th scope="col" className="py-2 pr-3 font-medium">
              Model
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Rating (BT)
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Elo
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
              Votes
            </th>
            <th scope="col" className="py-2 font-medium">
              Won / tied / lost
            </th>
          </tr>
        </thead>
        <tbody>
          {arena.models.map((m) => (
            <tr key={m.model} className="border-t border-line">
              <th scope="row" className="py-2 pr-3 text-left font-medium">
                {m.model}
              </th>
              <td className="py-2 pr-3 font-semibold">{m.bt}</td>
              <td className="py-2 pr-3">{m.elo}</td>
              <td className="py-2 pr-3">{m.games}</td>
              <td className="py-2">
                {m.wins} / {m.ties} / {m.losses}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
