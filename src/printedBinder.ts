import type { MiniFigEntry, PrintableMiniFigEntry, PrintCatalogue } from "./types";

export function getPrintedEntries(
  entries: MiniFigEntry[],
  catalogues: PrintCatalogue[],
): PrintableMiniFigEntry[] {
  const quantities = new Map<string, number>();
  for (const catalogue of catalogues) {
    if (catalogue.printed !== true) continue;
    for (const { creatureId, quantity } of catalogue.entries) {
      quantities.set(creatureId, (quantities.get(creatureId) ?? 0) + quantity);
    }
  }
  return entries.flatMap((entry) => {
    const quantity = quantities.get(entry.id) ?? 0;
    return quantity > 0 ? [{ ...entry, quantity }] : [];
  }).sort((a, b) => a.name.localeCompare(b.name));
}
