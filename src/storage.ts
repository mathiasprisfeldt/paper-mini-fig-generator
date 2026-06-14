import type { Catalogue, MiniFigEntry } from "./types";

const CATALOGUES_KEY = "paper-mini-fig-catalogues";
const ACTIVE_CATALOGUE_KEY = "paper-mini-fig-active-catalogue";

export function loadCatalogues(): Catalogue[] {
  try {
    const raw = localStorage.getItem(CATALOGUES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Catalogue[];
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
