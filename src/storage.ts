import type { Catalogue, CreatureSize, MiniFigEntry, MiniSize, PaperFormat } from "./types";

const CATALOGUES_KEY = "paper-mini-fig-catalogues";
const ACTIVE_CATALOGUE_KEY = "paper-mini-fig-active-catalogue";
const PAPER_FORMAT_KEY = "paper-mini-fig-paper-format";

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

const VALID_PAPER_FORMATS: PaperFormat[] = ["a4", "a3"];

export function getPaperFormat(): PaperFormat {
  const raw = localStorage.getItem(PAPER_FORMAT_KEY);
  if (raw && VALID_PAPER_FORMATS.includes(raw as PaperFormat)) {
    return raw as PaperFormat;
  }
  return "a4";
}

export function setPaperFormat(format: PaperFormat): void {
  localStorage.setItem(PAPER_FORMAT_KEY, format);
}
