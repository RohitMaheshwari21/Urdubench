import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p>
        That page does not exist.{" "}
        <Link href="/" className="text-accent underline">
          Back to the leaderboard
        </Link>
        .
      </p>
    </div>
  );
}
