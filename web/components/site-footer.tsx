import Link from "next/link";
import { GITHUB_URL } from "@/lib/data";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap justify-between gap-4 px-4 py-6 text-sm text-muted sm:px-6">
        <p>
          Open benchmark for Urdu and Roman Urdu. Preliminary results; items not yet validated by native
          speakers.
        </p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          <li>
            <Link href="/privacy" className="underline">
              Privacy
            </Link>
          </li>
          <li>
            <Link href="/cite" className="underline">
              Cite
            </Link>
          </li>
          <li>
            <a href={GITHUB_URL} className="underline" rel="noopener noreferrer">
              GitHub
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
}
