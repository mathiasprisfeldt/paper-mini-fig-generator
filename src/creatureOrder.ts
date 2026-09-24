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
    if (first && !second) return -1;
    if (!first && second) return 1;
    if (first && second) {
      // Older libraries have no creation date; their source list retains insertion order.
      const byDate = second.date - first.date;
      if (byDate) return byDate;
      const bySourcePosition = second.index - first.index;
      if (bySourcePosition) return bySourcePosition;
    }
    return a.name.localeCompare(b.name);
  });
}
