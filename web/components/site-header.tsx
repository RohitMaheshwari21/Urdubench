import Link from "next/link";
import { NavLinks } from "./nav-links";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-baseline gap-2 font-bold">
          <span className="text-lg">Urdu-Bench</span>
          <span className="urdu text-base text-muted" lang="ur" dir="rtl">
            اردو بینچ
          </span>
        </Link>
        <nav aria-label="Main">
          <NavLinks />
        </nav>
      </div>
    </header>
  );
}
