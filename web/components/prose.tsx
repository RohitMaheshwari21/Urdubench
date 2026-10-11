import type { ReactNode } from "react";

/** Consistent typography for text pages. */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div
      className="max-w-2xl space-y-4 [&_a]:text-accent [&_a]:underline [&_code]:rounded [&_code]:bg-surface [&_code]:px-1 [&_code]:font-mono [&_code]:text-sm [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:font-semibold [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:ps-6 [&_table]:w-full [&_table]:text-sm [&_td]:border-t [&_td]:border-line [&_td]:py-2 [&_td]:pe-3 [&_th]:py-2 [&_th]:pe-3 [&_th]:text-start [&_ul]:list-disc [&_ul]:ps-6"
    >
      {children}
    </div>
  );
}

export function CodeBlock({ children, label }: { children: string; label: string }) {
  return (
    <pre
      tabIndex={0}
      aria-label={label}
      className="overflow-x-auto rounded-lg border border-line bg-surface p-3 font-mono text-sm"
    >
      <code className="!bg-transparent !p-0">{children}</code>
    </pre>
  );
}
