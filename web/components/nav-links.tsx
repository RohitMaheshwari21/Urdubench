"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Leaderboard" },
  { href: "/explorer", label: "Explorer" },
  { href: "/methodology", label: "Methodology" },
  { href: "/about", label: "About" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <ul className="flex flex-wrap gap-x-1 gap-y-1 text-sm">
      {LINKS.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`inline-block rounded-md px-3 py-2 ${
                active ? "bg-accent-soft font-semibold text-accent" : "text-muted hover:text-foreground"
              }`}
            >
              {l.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
