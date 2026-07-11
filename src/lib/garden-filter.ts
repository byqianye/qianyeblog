import type { GardenKind } from "./garden";

export interface GardenFilter { kind?: GardenKind; tag?: string; }
export interface FilterableEntry { kind: GardenKind; tags: string[]; }

export function matchesGardenFilter(entry: FilterableEntry, filter: GardenFilter) {
  return (!filter.kind || entry.kind === filter.kind) && (!filter.tag || entry.tags.includes(filter.tag));
}
