import { getCollection, type CollectionEntry } from "astro:content";
import { matchesGardenFilter, type GardenFilter } from "./garden-filter";

export type GardenEntry = CollectionEntry<"blog">;
export type GardenKind = GardenEntry["data"]["kind"];

export const kindLabels: Record<GardenKind, string> = { article: "文章", note: "笔记", resource: "资源" };

export const sortEntries = (entries: GardenEntry[]) => [...entries].sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

export const filterEntries = (entries: GardenEntry[], options: GardenFilter = {}) =>
  entries.filter((entry) => matchesGardenFilter({ kind: entry.data.kind, tags: entry.data.tags }, options));

export async function getGardenEntries() {
  return sortEntries(await getCollection("blog", ({ data }) => !data.draft));
}

export async function getGardenTags() {
  const counts = new Map<string, number>();
  for (const entry of await getGardenEntries()) for (const tag of entry.data.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => a.tag.localeCompare(b.tag, "zh-Hans-CN"));
}

export function getRelatedEntries(current: GardenEntry, entries: GardenEntry[], limit = 3) {
  const tags = new Set(current.data.tags);
  return entries.filter((entry) => entry.id !== current.id)
    .map((entry) => ({ entry, score: entry.data.tags.filter((tag) => tags.has(tag)).length * 2 + Number(entry.data.kind === current.data.kind) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.entry.data.pubDate.valueOf() - a.entry.data.pubDate.valueOf())
    .slice(0, limit).map(({ entry }) => entry);
}

export function getEntryNeighbors(current: GardenEntry, entries: GardenEntry[]) {
  const index = entries.findIndex((entry) => entry.id === current.id);
  return { previous: index >= 0 ? entries[index + 1] : undefined, next: index > 0 ? entries[index - 1] : undefined };
}

export function formatDate(date: Date, compact = false) {
  return new Intl.DateTimeFormat("zh-CN", compact ? { year: "numeric", month: "2-digit", day: "2-digit" } : { year: "numeric", month: "long", day: "numeric" }).format(date);
}

export function getReadingMinutes(body = "") {
  const text = body.replace(/<[^>]+>/g, "").trim();
  return Math.max(1, Math.ceil(((text.match(/[\u4e00-\u9fff]/g)?.length ?? 0) + (text.match(/[A-Za-z0-9]+/g)?.length ?? 0) * 2) / 500));
}
