import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/data";
import { TASK_LIST } from "@/lib/tasks";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "",
    "/explorer",
    ...TASK_LIST.map((t) => `/explorer/${t.slug}`),
    "/methodology",
    "/about",
    "/privacy",
    "/cite",
  ];
  return paths.map((p) => ({ url: `${SITE_URL}${p}` }));
}
