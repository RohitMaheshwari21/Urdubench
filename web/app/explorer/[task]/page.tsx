import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExplorerList } from "@/components/explorer-list";
import { getItems } from "@/lib/data";
import { toUnits } from "@/lib/explorer";
import { TASK_LIST, taskFromSlug } from "@/lib/tasks";

export function generateStaticParams() {
  return TASK_LIST.map((t) => ({ task: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/explorer/[task]">): Promise<Metadata> {
  const { task } = await params;
  const info = taskFromSlug(task);
  return info ? { title: `${info.id}: ${info.name}`, description: info.description } : {};
}

export default async function TaskExplorer({ params }: PageProps<"/explorer/[task]">) {
  const { task } = await params;
  const info = taskFromSlug(task);
  if (!info) notFound();
  const units = toUnits(getItems(info.id));

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/explorer" className="text-accent underline">
          Question explorer
        </Link>{" "}
        / {info.id}
      </nav>
      <header>
        <h1 className="text-3xl font-bold">
          {info.id}: {info.name}
        </h1>
        <p className="mt-2 max-w-2xl text-muted">{info.description}</p>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          These are dev items: drafted by an AI assistant and <strong>not yet validated</strong> by native
          speakers. If you spot a mistake, please{" "}
          <a href="https://github.com/RohitMaheshwari21/Urdubench/issues" className="underline">
            report it
          </a>
          .
        </p>
      </header>
      <ExplorerList units={units} />
    </div>
  );
}
