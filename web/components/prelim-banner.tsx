import Link from "next/link";

export function PrelimBanner() {
  return (
    <div role="note" className="rounded-lg border border-line bg-notice p-4 text-sm text-notice-fg">
      <p className="font-semibold">Preliminary results</p>
      <p className="mt-1">
        Scores below come from the small public <strong>dev split</strong> (150 items). The items were drafted
        by an AI assistant and have <strong>not yet been validated by native speakers</strong>, and the private
        test split has not been run. Treat differences smaller than the intervals as noise.{" "}
        <Link href="/methodology" className="underline">
          How this works
        </Link>
        .
      </p>
    </div>
  );
}
