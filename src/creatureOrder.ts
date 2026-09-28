import type { CreatureOrder, CreatureSource, MiniFigEntry } from "./types";

export function sortCreatureEntries<T extends MiniFigEntry>(
  entries: T[],
  sources: CreatureSource[],
  order: CreatureOrder,
): T[] {
  if (order === "name") {
    return [...entries].sort((a, b) => a.name.localeCompare(b.name));
  }

  const sourceOrder = new Map(
    sources.map((source, index) => [source.id, { date: source.createdAt, index }]),
  );
  return [...entries].sort((a, b) => {
    const first = a.sourceId ? sourceOrder.get(a.sourceId) : undefined;
    const second = b.sourceId ? sourceOrder.get(b.sourceId) : undefined;
    // Use the source date only for entries saved before per-image dates existed.
    const firstDate = a.createdAt ?? first?.date ?? 0;
    const secondDate = b.createdAt ?? second?.date ?? 0;
    if (secondDate !== firstDate) return secondDate - firstDate;
    if (a.createdAt === null && b.createdAt === null && first && second) {
      const bySourcePosition = second.index - first.index;
      if (bySourcePosition) return bySourcePosition;
    }
    return a.name.localeCompare(b.name);
  });
}
