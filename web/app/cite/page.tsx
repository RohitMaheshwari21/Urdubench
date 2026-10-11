import type { Metadata } from "next";
import { CodeBlock, Prose } from "@/components/prose";
import { GITHUB_URL, SITE_URL } from "@/lib/data";

export const metadata: Metadata = {
  title: "Cite",
  description: "How to cite Urdu-Bench.",
};

const BIBTEX = `@misc{urdubench2026,
  title  = {Urdu-Bench: an open benchmark for Urdu and Roman Urdu language models},
  author = {Maheshwari, Rohit},
  year   = {2026},
  url    = {${GITHUB_URL}},
  note   = {Preliminary dev-split results; items not yet validated by native speakers. Site: ${SITE_URL}}
}`;

export default function Cite() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Cite Urdu-Bench</h1>
      <Prose>
        <p>
          There is no paper yet. Until there is, please cite the repository and say which results you used (preliminary
          dev split, dataset version 0.0.0 draft). Do not describe the numbers as final: the items have not been validated.
        </p>
        <CodeBlock label="BibTeX entry">{BIBTEX}</CodeBlock>
        <p>
          The planned license for the public dev items is CC BY 4.0. The code is in the{" "}
          <a href={GITHUB_URL}>GitHub repository</a>. This citation will be updated when a versioned release and a
          write-up exist.
        </p>
      </Prose>
    </div>
  );
}
