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
  const direction = order === "created-asc" ? 1 : -1;
  return [...entries].sort((a, b) => {
    const first = a.sourceId ? sourceOrder.get(a.sourceId) : undefined;
    const second = b.sourceId ? sourceOrder.get(b.sourceId) : undefined;
    // Use the source date only for entries saved before per-image dates existed.
    const firstDate = a.createdAt ?? first?.date ?? null;
    const secondDate = b.createdAt ?? second?.date ?? null;
    if (firstDate === null || firstDate === 0) {
      if (secondDate !== null && secondDate !== 0) return 1;
    } else if (secondDate === null || secondDate === 0) {
      return -1;
    } else if (secondDate !== firstDate) {
      return direction * (firstDate - secondDate);
    }
    if (a.createdAt === null && b.createdAt === null && first && second) {
      const bySourcePosition = direction * (first.index - second.index);
      if (bySourcePosition) return bySourcePosition;
    }
    return a.name.localeCompare(b.name);
  });
}
