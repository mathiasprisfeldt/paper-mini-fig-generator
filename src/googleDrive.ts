import type {
  Catalogue,
  CreatureSource,
  DriveCreatureSource,
  MiniFigEntry,
  PaperFormat,
} from "./types";
import type { DiscoveredCreature } from "./sourceDiscovery";

const DRIVE_SCOPE = [
  "https://www.googleapis.com/auth/drive.appdata",
  "https://www.googleapis.com/auth/drive.file",
].join(" ");
const MANIFEST_NAME = "paper-mini-fig-catalogues.json";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const GIS_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const DRIVE_DOWNLOAD_CONCURRENCY = 6;

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken: (config?: { prompt?: string }) => void;
}

interface GoogleOAuthApi {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: GoogleTokenResponse) => void;
    error_callback?: (error: { type?: string }) => void;
  }) => GoogleTokenClient;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: GoogleOAuthApi;
      };
    };
  }
}

interface DriveFile {
  id: string;
  name: string;
  mimeType?: string;
}

interface DriveFileList {
  files?: DriveFile[];
  nextPageToken?: string;
}

interface DriveManifest {
  version: 1 | 2 | 3 | 4;
  savedAt: number;
  catalogues: Catalogue[];
  paperFormat?: PaperFormat;
  sources?: CreatureSource[];
}

export interface DriveLibrary {
  catalogues: Catalogue[];
  paperFormat?: PaperFormat;
  sources: CreatureSource[];
}

function normalizeSource(value: unknown): CreatureSource | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  if (typeof source.id !== "string" || typeof source.name !== "string") return null;
  const updatedAt = typeof source.updatedAt === "number" ? source.updatedAt : 0;
  if (
    source.type === "drive" &&
    typeof source.folderId === "string" &&
    typeof source.folderName === "string"
  ) {
    return {
      type: "drive",
      id: source.id,
      name: source.name,
      folderId: source.folderId,
      folderName: source.folderName,
      updatedAt,
    };
  }
  if (typeof source.url === "string" && typeof source.selector === "string") {
    return {
      type: "html",
      id: source.id,
      name: source.name,
      url: source.url,
      selector: source.selector,
      updatedAt,
    };
  }
  return null;
}

export class DriveAuthError extends Error {}

let googleIdentityServicesPromise: Promise<void> | null = null;

function loadGoogleIdentityServices(): Promise<void> {
  if (window.google?.accounts.oauth2) return Promise.resolve();
  if (googleIdentityServicesPromise) return googleIdentityServicesPromise;

  const loadingPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SCRIPT_URL}"]`,
    );

    const onLoad = () => {
      if (window.google?.accounts.oauth2) {
        resolve();
        return;
      }
      reject(new Error("Google sign-in did not initialize."));
    };
    const onError = () => reject(new Error("Could not load Google sign-in."));

    const script = document.createElement("script");
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    if (existing?.nonce) script.nonce = existing.nonce;
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    document.head.appendChild(script);
  }).catch((error) => {
    googleIdentityServicesPromise = null;
    throw error;
  });
  googleIdentityServicesPromise = loadingPromise;

  return loadingPromise;
}

export async function connectGoogleDrive(clientId: string): Promise<string> {
  if (!clientId) {
    throw new Error("Google Drive is not configured for this deployment.");
  }

  await loadGoogleIdentityServices();

  return new Promise((resolve, reject) => {
    const oauth2 = window.google?.accounts.oauth2;
    if (!oauth2) {
      reject(new Error("Google sign-in did not initialize."));
      return;
    }

    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(
            new DriveAuthError(
              response.error_description || response.error || "Access denied.",
            ),
          );
          return;
        }
        resolve(response.access_token);
      },
      error_callback: () => {
        reject(new DriveAuthError("Google Drive connection was cancelled."));
      },
    });

    client.requestAccessToken({ prompt: "" });
  });
}

async function driveFetch(
  accessToken: string,
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(input, { ...init, headers });
  if (response.status === 401) {
    throw new DriveAuthError("Your Google Drive session expired. Reconnect to continue.");
  }
  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as {
        error?: { message?: string };
      };
      detail = body.error?.message || "";
    } catch {
      // The response may not contain JSON.
    }
    throw new Error(detail || `Google Drive request failed (${response.status}).`);
  }
  return response;
}

async function findAppDataFile(
  accessToken: string,
  name: string,
): Promise<DriveFile | null> {
  const params = new URLSearchParams({
    spaces: "appDataFolder",
    q: `name = '${name.replaceAll("'", "\\'")}'`,
    fields: "files(id,name)",
    pageSize: "1",
  });
  const response = await driveFetch(
    accessToken,
    `${DRIVE_API}/files?${params.toString()}`,
  );
  const result = (await response.json()) as DriveFileList;
  return result.files?.[0] ?? null;
}

async function listAppDataFiles(accessToken: string): Promise<DriveFile[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      spaces: "appDataFolder",
      fields: "nextPageToken,files(id,name)",
      pageSize: "1000",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const response = await driveFetch(
      accessToken,
      `${DRIVE_API}/files?${params.toString()}`,
    );
    const result = (await response.json()) as DriveFileList;
    files.push(...(result.files ?? []));
    pageToken = result.nextPageToken;
  } while (pageToken);

  return files;
}

async function createAppDataFile(
  accessToken: string,
  name: string,
  mimeType: string,
): Promise<string> {
  const params = new URLSearchParams({ fields: "id" });
  const response = await driveFetch(
    accessToken,
    `${DRIVE_API}/files?${params.toString()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        mimeType,
        parents: ["appDataFolder"],
      }),
    },
  );
  const file = (await response.json()) as { id?: string };
  if (!file.id) throw new Error("Google Drive did not return a file ID.");
  return file.id;
}

async function uploadFileContent(
  accessToken: string,
  fileId: string,
  content: Blob,
): Promise<void> {
  const params = new URLSearchParams({ uploadType: "media" });
  await driveFetch(
    accessToken,
    `${DRIVE_UPLOAD_API}/files/${encodeURIComponent(fileId)}?${params.toString()}`,
    {
      method: "PATCH",
      headers: { "Content-Type": content.type || "application/octet-stream" },
      body: content,
    },
  );
}

async function downloadFile(
  accessToken: string,
  fileId: string,
): Promise<Blob> {
  const params = new URLSearchParams({ alt: "media" });
  const response = await driveFetch(
    accessToken,
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?${params.toString()}`,
  );
  return response.blob();
}

async function deleteFile(accessToken: string, fileId: string): Promise<void> {
  await driveFetch(
    accessToken,
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}`,
    { method: "DELETE" },
  );
}

function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return fetch(dataUrl).then((response) => response.blob());
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result as string), {
      once: true,
    });
    reader.addEventListener("error", () => reject(reader.error), { once: true });
    reader.readAsDataURL(blob);
  });
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export async function discoverDriveFolderCreatures(
  accessToken: string,
  source: DriveCreatureSource,
): Promise<DiscoveredCreature[]> {
  const files: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      spaces: "drive",
      q: `'${source.folderId.replaceAll("'", "\\'")}' in parents and trashed = false and mimeType contains 'image/'`,
      fields: "nextPageToken,files(id,name,mimeType)",
      pageSize: "1000",
      orderBy: "name",
      includeItemsFromAllDrives: "true",
      supportsAllDrives: "true",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await driveFetch(
      accessToken,
      `${DRIVE_API}/files?${params.toString()}`,
    );
    const result = (await response.json()) as DriveFileList;
    files.push(...(result.files ?? []));
    pageToken = result.nextPageToken;
  } while (pageToken);

  return mapWithConcurrency(
    files,
    DRIVE_DOWNLOAD_CONCURRENCY,
    async (file) => ({
      id: `source-${source.id}-${file.id}`,
      name: file.name.replace(/\.[^.]+$/, ""),
      imageDataUrl: await blobToDataUrl(await downloadFile(accessToken, file.id)),
      imageUrl: null,
      imageDriveFileId: file.id,
    }),
  );
}

function imageExtension(mimeType: string): string {
  const subtype = mimeType.split("/")[1]?.split("+")[0];
  return subtype?.replace(/[^a-z0-9]/gi, "") || "image";
}

async function ensureImageFile(
  accessToken: string,
  entry: MiniFigEntry,
): Promise<MiniFigEntry> {
  if (entry.imageUrl || entry.imageDriveFileId || !entry.imageDataUrl) return entry;

  const blob = await dataUrlToBlob(entry.imageDataUrl);
  const fileId = await createAppDataFile(
    accessToken,
    `mini-${entry.id}.${imageExtension(blob.type)}`,
    blob.type || "application/octet-stream",
  );
  await uploadFileContent(accessToken, fileId, blob);
  return {
    ...entry,
    imageDriveFileId: fileId,
  };
}

function withoutImageData(catalogues: Catalogue[]): Catalogue[] {
  return catalogues.map((catalogue) => ({
    ...catalogue,
    entries: catalogue.entries.map((entry) => ({
      ...entry,
      imageDataUrl: null,
    })),
  }));
}

async function deleteOrphanedImages(
  accessToken: string,
  catalogues: Catalogue[],
): Promise<void> {
  const referencedIds = new Set(
    catalogues.flatMap((catalogue) =>
      catalogue.entries.flatMap((entry) =>
        entry.imageDriveFileId ? [entry.imageDriveFileId] : [],
      ),
    ),
  );
  const files = await listAppDataFiles(accessToken);
  const orphanedImages = files.filter(
    (file) => file.name.startsWith("mini-") && !referencedIds.has(file.id),
  );

  await Promise.allSettled(
    orphanedImages.map((file) => deleteFile(accessToken, file.id)),
  );
}

export async function saveCataloguesToDrive(
  accessToken: string,
  catalogues: Catalogue[],
  paperFormat?: PaperFormat,
  sources: CreatureSource[] = [],
): Promise<DriveLibrary> {
  const cataloguesWithFiles = await Promise.all(
    catalogues.map(async (catalogue) => ({
      ...catalogue,
      entries: await Promise.all(
        catalogue.entries.map((entry) =>
          ensureImageFile(accessToken, entry),
        ),
      ),
    })),
  );

  const manifest: DriveManifest = {
    version: 4,
    savedAt: Date.now(),
    catalogues: withoutImageData(cataloguesWithFiles),
    paperFormat,
    sources,
  };
  const manifestBlob = new Blob([JSON.stringify(manifest)], {
    type: "application/json",
  });

  const existing = await findAppDataFile(accessToken, MANIFEST_NAME);
  const fileId =
    existing?.id ??
    (await createAppDataFile(
      accessToken,
      MANIFEST_NAME,
      "application/json",
    ));
  await uploadFileContent(accessToken, fileId, manifestBlob);
  await deleteOrphanedImages(accessToken, cataloguesWithFiles);

  return { catalogues: cataloguesWithFiles, paperFormat, sources };
}

function isCatalogue(value: unknown): value is Catalogue {
  if (!value || typeof value !== "object") return false;
  const catalogue = value as Partial<Catalogue>;
  return (
    typeof catalogue.id === "string" &&
    typeof catalogue.name === "string" &&
    Array.isArray(catalogue.entries) &&
    typeof catalogue.createdAt === "number" &&
    typeof catalogue.updatedAt === "number"
  );
}

async function hydrateEntryImage(
  accessToken: string,
  entry: MiniFigEntry,
): Promise<MiniFigEntry> {
  if (entry.imageUrl) return { ...entry, imageDataUrl: null };
  if (!entry.imageDriveFileId) return { ...entry, imageDataUrl: null };
  try {
    const blob = await downloadFile(accessToken, entry.imageDriveFileId);
    return { ...entry, imageDataUrl: await blobToDataUrl(blob) };
  } catch (error) {
    if (error instanceof DriveAuthError) throw error;
    return { ...entry, imageDataUrl: null };
  }
}

export async function loadCataloguesFromDrive(
  accessToken: string,
): Promise<DriveLibrary | null> {
  const file = await findAppDataFile(accessToken, MANIFEST_NAME);
  if (!file) return null;

  const manifestBlob = await downloadFile(accessToken, file.id);
  const manifest = JSON.parse(await manifestBlob.text()) as Partial<DriveManifest>;
  if (![1, 2, 3, 4].includes(manifest.version ?? 0) || !Array.isArray(manifest.catalogues)) {
    throw new Error("The Google Drive catalogue file has an unsupported format.");
  }

  const catalogues = manifest.catalogues.filter(isCatalogue);
  const hydratedCatalogues = await Promise.all(
    catalogues.map(async (catalogue) => ({
      ...catalogue,
      entries: await Promise.all(
        catalogue.entries.map((entry) => hydrateEntryImage(accessToken, entry)),
      ),
    })),
  );
  const paperFormat = ["a4", "a3"].includes(manifest.paperFormat ?? "")
    ? manifest.paperFormat
    : undefined;
  return {
    catalogues: hydratedCatalogues,
    paperFormat,
    sources: Array.isArray(manifest.sources)
      ? manifest.sources.flatMap((source) => normalizeSource(source) ?? [])
      : [],
  };
}
