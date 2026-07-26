import type {
  Catalogue,
  CreatureSource,
  CreatureSize,
  MiniFigEntry,
  MiniSize,
  PaperFormat,
} from "./types";

const CATALOGUES_KEY = "paper-mini-fig-catalogues";
const ACTIVE_CATALOGUE_KEY = "paper-mini-fig-active-catalogue";
const PAPER_FORMAT_KEY = "paper-mini-fig-paper-format";
const SOURCES_KEY = "paper-mini-fig-sources";
const DRIVE_CONNECTION_KEY = "paper-mini-fig-drive-connected";
const DRIVE_SESSION_KEY = "paper-mini-fig-drive-session";
const DRIVE_SESSION_VERSION = 2;
const DRIVE_SESSION_EXPIRY_BUFFER_MS = 30_000;

const VALID_MINI_SIZES: MiniSize[] = [24, 28, 32];
const VALID_CREATURE_SIZES: CreatureSize[] = [
  "tiny", "small", "medium", "large", "huge", "gargantuan",
];

export function migrateMiniFigEntry(e: unknown): MiniFigEntry {
  const raw =
    e && typeof e === "object" ? e as Record<string, unknown> : {};
  const quantity =
    typeof raw.quantity === "number" && Number.isFinite(raw.quantity)
      ? Math.min(99, Math.max(0, Math.trunc(raw.quantity)))
      : 1;
  return {
    id:
      typeof raw.id === "string" && raw.id
        ? raw.id
        : crypto.randomUUID(),
    name: typeof raw.name === "string" ? raw.name : "",
    imageDataUrl:
      typeof raw.imageDataUrl === "string" ? raw.imageDataUrl : null,
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl : null,
    imageDriveFileId:
      typeof raw.imageDriveFileId === "string"
        ? raw.imageDriveFileId
        : null,
    sourceId: typeof raw.sourceId === "string" ? raw.sourceId : null,
    quantity,
    showName: typeof raw.showName === "boolean" ? raw.showName : true,
    miniSize: VALID_MINI_SIZES.includes(raw.miniSize as MiniSize)
      ? (raw.miniSize as MiniSize)
      : 28,
    creatureSize: VALID_CREATURE_SIZES.includes(raw.creatureSize as CreatureSize)
      ? (raw.creatureSize as CreatureSize)
      : "medium",
  };
}

export function loadCatalogues(): Catalogue[] {
  try {
    const raw = localStorage.getItem(CATALOGUES_KEY);
    if (!raw) return [];
    const catalogues = JSON.parse(raw) as Catalogue[];
    return catalogues.map((c) => ({
      ...c,
      entries: c.entries.map(migrateMiniFigEntry),
    }));
  } catch {
    return [];
  }
}

export function saveCatalogues(catalogues: Catalogue[]): void {
  // Keep pre-integration images only until their entry has a Drive file ID.
  // Newly selected images are never added to localStorage.
  const legacyImages = new Map<string, string>();
  try {
    const existing = JSON.parse(
      localStorage.getItem(CATALOGUES_KEY) || "[]",
    ) as Catalogue[];
    for (const catalogue of existing) {
      for (const entry of catalogue.entries) {
        if (entry.imageDataUrl) legacyImages.set(entry.id, entry.imageDataUrl);
      }
    }
  } catch {
    // Invalid legacy state will be replaced with clean metadata.
  }

  const metadataOnly = catalogues.map((catalogue) => ({
    ...catalogue,
    entries: catalogue.entries.map((entry) => ({
      ...entry,
      imageDataUrl: entry.imageDriveFileId
        ? null
        : (legacyImages.get(entry.id) ?? null),
    })),
  }));
  localStorage.setItem(CATALOGUES_KEY, JSON.stringify(metadataOnly));
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

export function loadSources(): CreatureSource[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SOURCES_KEY) || "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    const sources: CreatureSource[] = [];
    for (const value of raw) {
      if (!value || typeof value !== "object") continue;
      const source = value as Partial<CreatureSource> & Record<string, unknown>;
      if (typeof source.id !== "string" || typeof source.name !== "string") continue;
      const updatedAt = typeof source.updatedAt === "number" ? source.updatedAt : 0;
      if (
        source.type === "drive" &&
        typeof source.folderId === "string" &&
        typeof source.folderName === "string"
      ) {
        sources.push({
          type: "drive" as const,
          id: source.id,
          name: source.name,
          folderId: source.folderId,
          folderName: source.folderName,
          updatedAt,
        });
        continue;
      }
      if (
        source.type !== "html" ||
        typeof source.url !== "string" ||
        typeof source.selector !== "string"
      ) {
        continue;
      }
      sources.push({
        type: "html" as const,
        id: source.id,
        name: source.name,
        url: source.url,
        selector: source.selector,
        updatedAt,
      });
    }
    return sources;
  } catch {
    return [];
  }
}

export function saveSources(sources: CreatureSource[]): void {
  localStorage.setItem(SOURCES_KEY, JSON.stringify(sources));
}

export function getDriveConnectionPreference(): boolean {
  try {
    return localStorage.getItem(DRIVE_CONNECTION_KEY) === "true";
  } catch {
    return false;
  }
}

export function setDriveConnectionPreference(connected: boolean): void {
  if (connected) {
    localStorage.setItem(DRIVE_CONNECTION_KEY, "true");
  } else {
    localStorage.removeItem(DRIVE_CONNECTION_KEY);
  }
}

export interface DriveSessionCredential {
  accessToken: string;
  expiresAt: number;
  scopes: string[];
}

export function getDriveSessionCredential(): DriveSessionCredential | null {
  try {
    const raw = sessionStorage.getItem(DRIVE_SESSION_KEY);
    if (!raw) return null;
    const credential = JSON.parse(raw) as Partial<DriveSessionCredential> & {
      version?: number;
    };
    if (
      credential.version !== DRIVE_SESSION_VERSION ||
      typeof credential.accessToken !== "string" ||
      typeof credential.expiresAt !== "number" ||
      !Array.isArray(credential.scopes) ||
      !credential.scopes.every((scope) => typeof scope === "string") ||
      !Number.isFinite(credential.expiresAt) ||
      credential.expiresAt <= Date.now() + DRIVE_SESSION_EXPIRY_BUFFER_MS
    ) {
      sessionStorage.removeItem(DRIVE_SESSION_KEY);
      return null;
    }
    return {
      accessToken: credential.accessToken,
      expiresAt: credential.expiresAt,
      scopes: credential.scopes,
    };
  } catch {
    return null;
  }
}

export function setDriveSessionCredential(
  credential: DriveSessionCredential,
): void {
  try {
    sessionStorage.setItem(DRIVE_SESSION_KEY, JSON.stringify({
      ...credential,
      version: DRIVE_SESSION_VERSION,
    }));
  } catch {
    // Autosync still works for this page even if session storage is unavailable.
  }
}

export function clearDriveSessionCredential(): void {
  try {
    sessionStorage.removeItem(DRIVE_SESSION_KEY);
  } catch {
    // The in-memory credential is still cleared by the caller.
  }
}
