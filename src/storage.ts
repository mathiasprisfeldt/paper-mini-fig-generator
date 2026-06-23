import type { Catalogue, CreatureSize, MiniFigEntry, MiniSize } from "./types";

const CATALOGUES_KEY = "paper-mini-fig-catalogues";
const ACTIVE_CATALOGUE_KEY = "paper-mini-fig-active-catalogue";

const VALID_MINI_SIZES: MiniSize[] = [24, 28, 32];
const VALID_CREATURE_SIZES: CreatureSize[] = [
  "tiny", "small", "medium", "large", "huge", "gargantuan",
];

function migrateEntry(e: unknown): MiniFigEntry {
  const raw = e as Record<string, unknown>;
  const miniSize: MiniSize = VALID_MINI_SIZES.includes(raw.miniSize as MiniSize)
    ? (raw.miniSize as MiniSize)
    : 28;
  const creatureSize: CreatureSize = VALID_CREATURE_SIZES.includes(
    raw.creatureSize as CreatureSize
  )
    ? (raw.creatureSize as CreatureSize)
    : "medium";
  return { ...(raw as unknown as MiniFigEntry), miniSize, creatureSize };
}

export function loadCatalogues(): Catalogue[] {
  try {
    const raw = localStorage.getItem(CATALOGUES_KEY);
    if (!raw) return [];
    const catalogues = JSON.parse(raw) as Catalogue[];
    return catalogues.map((c) => ({
      ...c,
      entries: c.entries.map(migrateEntry),
    }));
  } catch {
    return [];
  }
}

export function saveCatalogues(catalogues: Catalogue[]): void {
  localStorage.setItem(CATALOGUES_KEY, JSON.stringify(catalogues));
}

export function getActiveCatalogueId(): string | null {
  return localStorage.getItem(ACTIVE_CATALOGUE_KEY);
}

export function setActiveCatalogueId(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_CATALOGUE_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_CATALOGUE_KEY);
  }
}

export function createCatalogue(
  name: string,
  entries: MiniFigEntry[] = []
): Catalogue {
  return {
    id: crypto.randomUUID(),
    name,
    entries,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
