"use client";

import { useState } from "react";

export function DeleteMyData() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    const res = await fetch("/api/me", { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setMessage(data.message ?? (res.ok ? "Done." : "Could not delete right now. Please try again later."));
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="rounded-md border border-bad px-4 py-2 text-bad disabled:opacity-50"
      >
        Delete my arena votes and quiz answers
      </button>
      <p role="status" aria-live="polite" className="text-sm text-muted">
        {message}
      </p>
    </div>
  );
}
