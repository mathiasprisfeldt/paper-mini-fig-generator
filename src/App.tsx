import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Tab, Tabs } from "@mui/material";
import type {
  Catalogue,
  CreatureSource,
  MiniFigEntry,
  PaperFormat,
  PrintableMiniFigEntry,
  PrintLayout,
  SourceRefreshResult,
} from "./types";
import { AddCreatureForm } from "./components/AddCreatureForm";
import { AppModal } from "./components/AppModal";
import { CreatureBinder } from "./components/CreatureBinder";
import { ExportPreviewDialog } from "./components/ExportPreviewDialog";
import { PrintBuilder } from "./components/PrintBuilder";
import { QuickAddDialog } from "./components/QuickAddDialog";
import { SourceDialog, type SourceDraft } from "./components/SourceDialog";
import { DriveImageProvider } from "./driveImages";
import {
  GoogleDriveSync,
  type DriveSyncStatus,
} from "./components/GoogleDriveSync";
import { generatePdf, getEntryImageSource, isEntryOversized } from "./generatePdf";
import { discoverSourceCreatures, type DiscoveredCreature } from "./sourceDiscovery";
import {
  connectGoogleDrive,
  discoverDriveFolderCreatures,
  downloadDriveBackup,
  DriveAuthError,
  loadCataloguesFromDrive,
  loadDriveImages,
  saveCataloguesToDrive,
} from "./googleDrive";
import {
  clearDriveSessionCredential,
  createCatalogue,
  getDriveConnectionPreference,
  getDriveSessionCredential,
  getPaperFormat,
  loadSources,
  loadCatalogues,
  saveCatalogues,
  saveSources,
  setDriveConnectionPreference,
  setDriveSessionCredential,
  setPaperFormat as savePaperFormat,
} from "./storage";
import "./App.css";

type AppView = "binder" | "print" | "settings";
type AppModalId = "add-creature" | "sources" | "quick-add";
interface DriveSyncPayload {
  accessToken: string;
  catalogues: Catalogue[];
  paperFormat: PaperFormat;
  session: number;
  signature: string;
  sources: CreatureSource[];
}

const PREVIEW_QUERY_PARAM = "preview";
const MODAL_QUERY_PARAM = "modal";
const SOURCE_QUERY_PARAM = "source";
const VIEW_QUERY_PARAM = "view";
const APP_MODALS: AppModalId[] = ["add-creature", "sources", "quick-add"];
const APP_VIEWS: AppView[] = ["binder", "print", "settings"];
const DRIVE_AUTOSYNC_DELAY_MS = 1000;

function getModalFromUrl(): AppModalId | null {
  const modal = new URL(window.location.href).searchParams.get(MODAL_QUERY_PARAM);
  return APP_MODALS.includes(modal as AppModalId) ? modal as AppModalId : null;
}

function getSourceFilterFromUrl(): string | null {
  return new URL(window.location.href).searchParams.get(SOURCE_QUERY_PARAM);
}

function getViewFromUrl(): AppView {
  const view = new URL(window.location.href).searchParams.get(VIEW_QUERY_PARAM);
  return APP_VIEWS.includes(view as AppView) ? view as AppView : "binder";
}

function normalizeAsBinder(catalogues: Catalogue[]): Catalogue[] {
  if (catalogues.length === 0) return [createCatalogue("Creature Binder")];

  const seen = new Set<string>();
  const entries = catalogues.flatMap((catalogue) => catalogue.entries).filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
  const now = Date.now();
  const createdAtValues = catalogues
    .map((catalogue) => catalogue.createdAt)
    .filter(Number.isFinite);
  const updatedAtValues = catalogues
    .map((catalogue) => catalogue.updatedAt)
    .filter(Number.isFinite);
  const createdAt = createdAtValues.length > 0
    ? Math.min(...createdAtValues)
    : now;
  const updatedAt = updatedAtValues.length > 0
    ? Math.max(...updatedAtValues)
    : now;

  return [{
    id: catalogues[0].id,
    name: "Creature Binder",
    entries,
    createdAt,
    updatedAt,
  }];
}

function hashImageData(value: string | null): string | null {
  if (!value) return null;
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${value.length}:${hash >>> 0}`;
}

function createDriveSyncSignature(
  catalogues: Catalogue[],
  paperFormat: PaperFormat,
  sources: CreatureSource[],
): string {
  return JSON.stringify({
    catalogues: catalogues.map((catalogue) => ({
      ...catalogue,
      entries: catalogue.entries.map((entry) => ({
        id: entry.id,
        name: entry.name,
        imageData: entry.imageDriveFileId
          ? null
          : hashImageData(entry.imageDataUrl),
        imageUrl: entry.imageUrl,
        blurHash: entry.blurHash,
        sourceId: entry.sourceId,
        showName: entry.showName,
        miniSize: entry.miniSize,
        creatureSize: entry.creatureSize,
      })),
    })),
    paperFormat,
    sources,
  });
}

function hasEntryImage(entry: MiniFigEntry): boolean {
  return Boolean(getEntryImageSource(entry) || entry.imageDriveFileId);
}

function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? "";
  const googleAppId = import.meta.env.VITE_GOOGLE_APP_ID?.trim() ?? "";
  const googleDeveloperKey = import.meta.env.VITE_GOOGLE_API_KEY?.trim() ?? "";
  const googleDriveConfigured = Boolean(googleClientId);
  const googlePickerConfigured = Boolean(googleClientId && googleAppId && googleDeveloperKey);
  const [initialDriveSession] = useState(
    () => googleDriveConfigured ? getDriveSessionCredential() : null,
  );
  const [restoreDriveOnLoad] = useState(
    () =>
      googleDriveConfigured &&
      (Boolean(initialDriveSession) || getDriveConnectionPreference()),
  );
  const [catalogues, setCatalogues] = useState<Catalogue[]>(() =>
    normalizeAsBinder(loadCatalogues()),
  );
  const [view, setView] = useState<AppView>(getViewFromUrl);
  const [activeModal, setActiveModal] = useState<AppModalId | null>(getModalFromUrl);
  const [sourceFilter, setSourceFilter] = useState<string | null>(
    getSourceFilterFromUrl,
  );
  const [previewId, setPreviewId] = useState<string | null>(() =>
    new URL(window.location.href).searchParams.get(PREVIEW_QUERY_PARAM),
  );
  const [sources, setSources] = useState<CreatureSource[]>(loadSources);
  const [paperFormat, setPaperFormatState] = useState<PaperFormat>(getPaperFormat);
  const [printLayout, setPrintLayout] = useState<PrintLayout>("compact");
  const [printQuantities, setPrintQuantities] = useState<Record<string, number>>({});
  const [generating, setGenerating] = useState(false);
  const [exportError, setExportError] = useState("");
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(
    initialDriveSession?.accessToken ?? null,
  );
  const [driveStatus, setDriveStatus] = useState<DriveSyncStatus>(
    restoreDriveOnLoad ? "connecting" : "disconnected",
  );
  const [driveMessage, setDriveMessage] = useState(
    restoreDriveOnLoad
      ? "Restoring your Google Drive connection…"
      : googleDriveConfigured
      ? "Connect your account to load your Drive binder and start autosync."
      : "Set the Google client ID to enable Drive sync.",
  );
  const [driveAutosync, setDriveAutosync] = useState(false);
  const driveSession = useRef(0);
  const driveSyncInFlight = useRef(false);
  const queuedDriveSync = useRef<DriveSyncPayload | null>(null);
  const lastDriveSyncSignature = useRef<string | null>(null);
  const initialSourcesRefreshed = useRef(false);
  const driveRestoreAttempted = useRef(false);

  const entries = useMemo(() => catalogues[0]?.entries ?? [], [catalogues]);
  const printableEntries = useMemo<PrintableMiniFigEntry[]>(
    () => entries.map((entry) => ({
      ...entry,
      quantity: printQuantities[entry.id] ?? 0,
    })),
    [entries, printQuantities],
  );
  const selectedTotal = printableEntries.reduce(
    (sum, entry) => sum + entry.quantity,
    0,
  );
  const previewEntry =
    printableEntries.find((entry) => entry.id === previewId) ?? null;

  useEffect(() => {
    const syncNavigationFromHistory = () => {
      const url = new URL(window.location.href);
      setPreviewId(url.searchParams.get(PREVIEW_QUERY_PARAM));
      setActiveModal(getModalFromUrl());
      setSourceFilter(url.searchParams.get(SOURCE_QUERY_PARAM));
      setView(getViewFromUrl());
    };
    window.addEventListener("popstate", syncNavigationFromHistory);
    return () => window.removeEventListener("popstate", syncNavigationFromHistory);
  }, []);

  const changeView = useCallback((nextView: AppView) => {
    if (nextView === view) return;
    const url = new URL(window.location.href);
    if (nextView === "binder") {
      url.searchParams.delete(VIEW_QUERY_PARAM);
    } else {
      url.searchParams.set(VIEW_QUERY_PARAM, nextView);
    }
    window.history.pushState(
      { ...window.history.state, paperMiniView: nextView },
      "",
      url,
    );
    setView(nextView);
  }, [view]);

  const changeSourceFilter = useCallback((sourceId: string | null) => {
    const url = new URL(window.location.href);
    if (sourceId) {
      url.searchParams.set(SOURCE_QUERY_PARAM, sourceId);
    } else {
      url.searchParams.delete(SOURCE_QUERY_PARAM);
    }
    window.history.replaceState(window.history.state, "", url);
    setSourceFilter(sourceId);
  }, []);

  const openCreaturePreview = useCallback((id: string) => {
    const url = new URL(window.location.href);
    if (url.searchParams.get(PREVIEW_QUERY_PARAM) === id) {
      setPreviewId(id);
      return;
    }
    url.searchParams.set(PREVIEW_QUERY_PARAM, id);
    window.history.pushState(
      { ...window.history.state, paperMiniPreview: id },
      "",
      url,
    );
    setPreviewId(id);
  }, []);

  const closeCreaturePreview = useCallback(() => {
    const url = new URL(window.location.href);
    if (window.history.state?.paperMiniPreview === previewId) {
      window.history.back();
      return;
    }
    url.searchParams.delete(PREVIEW_QUERY_PARAM);
    window.history.replaceState(window.history.state, "", url);
    setPreviewId(null);
  }, [previewId]);

  const openNavigationModal = useCallback((modal: AppModalId) => {
    const url = new URL(window.location.href);
    if (url.searchParams.get(MODAL_QUERY_PARAM) === modal) {
      setActiveModal(modal);
      return;
    }
    url.searchParams.set(MODAL_QUERY_PARAM, modal);
    window.history.pushState(
      { ...window.history.state, paperMiniModal: modal },
      "",
      url,
    );
    setActiveModal(modal);
  }, []);

  const closeNavigationModal = useCallback((modal: AppModalId) => {
    const url = new URL(window.location.href);
    if (window.history.state?.paperMiniModal === modal) {
      window.history.back();
      return;
    }
    if (url.searchParams.get(MODAL_QUERY_PARAM) === modal) {
      url.searchParams.delete(MODAL_QUERY_PARAM);
      window.history.replaceState(window.history.state, "", url);
    }
    setActiveModal(null);
  }, []);

  useEffect(() => {
    saveCatalogues(catalogues);
  }, [catalogues]);

  useEffect(() => {
    saveSources(sources);
  }, [sources]);

  const setEntries = useCallback(
    (updater: (previous: MiniFigEntry[]) => MiniFigEntry[]) => {
      setCatalogues((current) => {
        const binder = current[0] ?? createCatalogue("Creature Binder");
        return [{
          ...binder,
          entries: updater(binder.entries),
          updatedAt: Date.now(),
        }];
      });
    },
    [],
  );

  const updateEntry = useCallback((id: string, patch: Partial<MiniFigEntry>) => {
    setEntries((current) =>
      current.map((entry) => entry.id === id ? { ...entry, ...patch } : entry),
    );
  }, [setEntries]);

  const addEntry = useCallback((entry: MiniFigEntry) => {
    setEntries((current) => [...current, entry]);
  }, [setEntries]);

  const removeEntry = useCallback((id: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }, [setEntries]);

  const applySourceResults = useCallback((
    source: CreatureSource,
    discovered: DiscoveredCreature[],
  ) => {
    setEntries((current) => {
      const existing = new Map(
        current
          .filter((entry) => entry.sourceId === source.id)
          .map((entry) => [entry.id, entry]),
      );
      const refreshedEntries = discovered.map((item): MiniFigEntry => {
        const saved = existing.get(item.id);
        return saved
          ? {
              ...saved,
              imageDataUrl: item.imageDataUrl,
              imageUrl: item.imageUrl,
              imageDriveFileId: item.imageDriveFileId,
              blurHash:
                saved.imageDataUrl === item.imageDataUrl
                && saved.imageUrl === item.imageUrl
                && saved.imageDriveFileId === item.imageDriveFileId
                  ? saved.blurHash
                  : null,
              sourceId: source.id,
            }
          : {
              id: item.id,
              name: item.name,
              imageDataUrl: item.imageDataUrl,
              imageUrl: item.imageUrl,
              imageDriveFileId: item.imageDriveFileId,
              blurHash: null,
              sourceId: source.id,
              showName: true,
              miniSize: 28,
              creatureSize: "medium",
            };
      });
      return [
        ...current.filter((entry) => entry.sourceId !== source.id),
        ...refreshedEntries,
      ];
    });
    setSources((current) => current.map((saved) =>
      saved.id === source.id ? { ...saved, updatedAt: Date.now() } : saved,
    ));
  }, [setEntries]);

  const refreshSource = useCallback(async (source: CreatureSource) => {
    if (source.type === "drive" && !driveAccessToken) {
      throw new Error("Connect Google Drive before refreshing this folder.");
    }
    const discovered = source.type === "html"
      ? await discoverSourceCreatures(source)
      : await discoverDriveFolderCreatures(driveAccessToken!, source);
    const existingIds = new Set(
      entries
        .filter((entry) => entry.sourceId === source.id)
        .map((entry) => entry.id),
    );
    const discoveredIds = new Set(discovered.map((entry) => entry.id));
    const result: SourceRefreshResult = {
      total: discovered.length,
      added: discovered.filter((entry) => !existingIds.has(entry.id)).length,
      removed: [...existingIds].filter((id) => !discoveredIds.has(id)).length,
    };
    applySourceResults(source, discovered);
    return result;
  }, [applySourceResults, driveAccessToken, entries]);

  const refreshAllSources = useCallback(async () => {
    const results = await Promise.allSettled(sources.map(refreshSource));
    const successful = results.filter((result) => result.status === "fulfilled");
    const failed = results.filter((result) => result.status === "rejected");
    const summary = successful.reduce<SourceRefreshResult>(
      (combined, result) => ({
        total: combined.total + result.value.total,
        added: combined.added + result.value.added,
        removed: combined.removed + result.value.removed,
      }),
      { total: 0, added: 0, removed: 0 },
    );

    if (failed.length > 0) {
      const firstError = failed[0].reason instanceof Error
        ? failed[0].reason.message
        : "A source could not be refreshed.";
      throw new Error(
        `${successful.length} of ${sources.length} sources refreshed. ${firstError}`,
      );
    }

    return summary;
  }, [refreshSource, sources]);

  const addSource = useCallback(async (draft: SourceDraft) => {
    const duplicate = sources.some((source) =>
      source.type === draft.type && (
        source.type === "html" && draft.type === "html"
          ? source.url === draft.url && source.selector === draft.selector
          : source.type === "drive" && draft.type === "drive" && source.folderId === draft.folderId
      ),
    );
    if (duplicate) {
      throw new Error("That source is already in your binder.");
    }
    const source: CreatureSource = {
      ...draft,
      id: crypto.randomUUID(),
      updatedAt: Date.now(),
    };
    if (source.type === "drive" && !driveAccessToken) {
      throw new Error("Connect Google Drive before adding a Drive folder.");
    }
    const discovered = source.type === "html"
      ? await discoverSourceCreatures(source)
      : await discoverDriveFolderCreatures(driveAccessToken!, source);
    if (source.type === "html" && discovered.length === 0) {
      throw new Error(
        "The selector did not find any links to supported image files.",
      );
    }
    setSources((current) => [...current, source]);
    applySourceResults(source, discovered);
    return discovered.length;
  }, [applySourceResults, driveAccessToken, sources]);

  const removeSource = useCallback((source: CreatureSource) => {
    setSources((current) => current.filter((saved) => saved.id !== source.id));
    setEntries((current) => current.filter((entry) => entry.sourceId !== source.id));
    if (sourceFilter === source.id) changeSourceFilter(null);
  }, [changeSourceFilter, setEntries, sourceFilter]);

  const renameSource = useCallback((source: CreatureSource, name: string) => {
    setSources((current) => current.map((saved) =>
      saved.id === source.id
        ? { ...saved, name, updatedAt: Date.now() }
        : saved,
    ));
  }, []);

  useEffect(() => {
    if (initialSourcesRefreshed.current) return;
    initialSourcesRefreshed.current = true;
    const timer = window.setTimeout(() => {
    for (const source of sources.filter((candidate) => candidate.type === "html")) {
        void refreshSource(source).catch(() => {
          // Keep the last successful source contents available when a host is offline.
        });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshSource, sources]);

  const setQuantity = useCallback((id: string, quantity: number) => {
    const nextQuantity = Math.min(99, Math.max(0, Math.round(quantity) || 0));
    setPrintQuantities((current) => {
      if (nextQuantity === 0) {
        const { [id]: _, ...rest } = current;
        return rest;
      }
      return { ...current, [id]: nextQuantity };
    });
  }, []);

  const clearPrintSelection = useCallback(() => {
    setPrintQuantities({});
  }, []);

  const handleSetPaperFormat = useCallback((format: PaperFormat) => {
    setPaperFormatState(format);
    savePaperFormat(format);
  }, []);

  const resolveDriveSourceEntries = useCallback(async (
    entriesToResolve: MiniFigEntry[],
  ): Promise<MiniFigEntry[]> => {
    const needsDrive = entriesToResolve.some(
      (entry) => entry.imageDriveFileId && !getEntryImageSource(entry),
    );
    if (!needsDrive) return entriesToResolve;
    if (!driveAccessToken) {
      throw new Error("Connect Google Drive to load this creature.");
    }
    return loadDriveImages(driveAccessToken, entriesToResolve);
  }, [driveAccessToken]);

  const resolvePreviewEntry = useCallback(async (
    entry: MiniFigEntry,
  ): Promise<MiniFigEntry> => {
    const [resolved] = await resolveDriveSourceEntries([entry]);
    return resolved;
  }, [resolveDriveSourceEntries]);

  const applyDriveFileIds = useCallback((saved: Catalogue[]) => {
    const fileIds = new Map(
      saved.flatMap((catalogue) =>
        catalogue.entries.map((entry) => [entry.id, entry.imageDriveFileId] as const),
      ),
    );
    setCatalogues((current) => {
      let changed = false;
      const next = current.map((catalogue) => {
        const entries = catalogue.entries.map((entry) => {
          if (!fileIds.has(entry.id)) return entry;
          const imageDriveFileId = fileIds.get(entry.id) ?? null;
          if (imageDriveFileId === entry.imageDriveFileId) return entry;
          changed = true;
          return { ...entry, imageDriveFileId };
        });
        return entries.every((entry, index) => entry === catalogue.entries[index])
          ? catalogue
          : { ...catalogue, entries };
      });
      return changed ? next : current;
    });
  }, []);

  const handleDriveError = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : "Google Drive sync failed.";
    setDriveStatus("error");
    setDriveMessage(message);
    if (error instanceof DriveAuthError) {
      setDriveAccessToken(null);
      setDriveAutosync(false);
      clearDriveSessionCredential();
    }
  }, []);

  const handleAddCreature = useCallback(async (entry: MiniFigEntry) => {
    if (!entry.imageDataUrl) {
      addEntry(entry);
      closeNavigationModal("add-creature");
      return;
    }
    if (!driveAccessToken || !driveAutosync) {
      throw new Error("Connect Google Drive before uploading images.");
    }

    const binder = catalogues[0] ?? createCatalogue("Creature Binder");
    const nextCatalogues: Catalogue[] = [{
      ...binder,
      entries: [...binder.entries, entry],
      updatedAt: Date.now(),
    }];

    setDriveStatus("syncing");
    setDriveMessage("Uploading creature image to Drive…");
    try {
      const saved = await saveCataloguesToDrive(
        driveAccessToken,
        nextCatalogues,
        paperFormat,
        sources,
      );
      lastDriveSyncSignature.current = createDriveSyncSignature(
        saved.catalogues,
        paperFormat,
        sources,
      );
      setCatalogues(normalizeAsBinder(saved.catalogues));
      setDriveStatus("synced");
      setDriveMessage("Creature uploaded. All changes saved to Drive.");
      closeNavigationModal("add-creature");
    } catch (error) {
      handleDriveError(error);
      throw error;
    }
  }, [addEntry, catalogues, closeNavigationModal, driveAccessToken, driveAutosync, handleDriveError, paperFormat, sources]);

  const connectAndSyncDrive = useCallback(async (
    prompt: "" | "none",
    restoring = false,
    cachedAccessToken: string | null = null,
  ) => {
    const session = driveSession.current + 1;
    driveSession.current = session;
    setDriveStatus("connecting");
    setDriveMessage(
      restoring
        ? "Restoring your Google Drive connection…"
        : "Waiting for Google authorization…",
    );
    try {
      const syncAccessToken = async (accessToken: string) => {
        if (session !== driveSession.current) return;

        setDriveStatus("syncing");
        setDriveMessage("Loading your binder from Drive…");
        const remote = await loadCataloguesFromDrive(accessToken);
        if (session !== driveSession.current) return;

        let activeSources = sources;
        if (remote) {
          const remoteCatalogues = normalizeAsBinder(remote.catalogues);
          const remotePaperFormat = remote.paperFormat ?? paperFormat;
          lastDriveSyncSignature.current = createDriveSyncSignature(
            remoteCatalogues,
            remotePaperFormat,
            remote.sources,
          );
          setCatalogues(remoteCatalogues);
          setSources(remote.sources);
          activeSources = remote.sources;
          if (remote.paperFormat) handleSetPaperFormat(remote.paperFormat);
          setDriveMessage("Binder loaded from Drive. Autosync is on.");
        } else {
          setDriveMessage("Creating your Drive binder…");
          const saved = await saveCataloguesToDrive(
            accessToken,
            catalogues,
            paperFormat,
            sources,
          );
          if (session !== driveSession.current) return;
          const savedCatalogues = normalizeAsBinder(saved.catalogues);
          lastDriveSyncSignature.current = createDriveSyncSignature(
            savedCatalogues,
            paperFormat,
            sources,
          );
          setCatalogues(savedCatalogues);
          setDriveMessage("Drive binder created. Autosync is on.");
        }

        setDriveAccessToken(accessToken);
        setDriveAutosync(true);
        setDriveStatus("synced");
        setDriveConnectionPreference(true);

        for (const source of activeSources.filter((candidate) => candidate.type === "drive")) {
          void discoverDriveFolderCreatures(accessToken, source)
            .then((discovered) => applySourceResults(source, discovered))
            .catch(() => {
              // The folder may need to be selected again if its Picker grant expired.
            });
        }
      };

      let accessToken = cachedAccessToken;
      if (!accessToken) {
        const credential = await connectGoogleDrive(googleClientId, prompt);
        accessToken = credential.accessToken;
        setDriveSessionCredential(credential);
      }

      try {
        await syncAccessToken(accessToken);
      } catch (error) {
        if (!cachedAccessToken || !(error instanceof DriveAuthError)) {
          throw error;
        }
        clearDriveSessionCredential();
        const credential = await connectGoogleDrive(googleClientId, prompt);
        setDriveSessionCredential(credential);
        await syncAccessToken(credential.accessToken);
      }
    } catch (error) {
      if (session !== driveSession.current) return;
      setDriveAccessToken(null);
      setDriveAutosync(false);
      if (error instanceof DriveAuthError) {
        clearDriveSessionCredential();
      }
      if (restoring) {
        setDriveStatus("disconnected");
        setDriveMessage("Reconnect Google Drive to resume autosync.");
      } else {
        setDriveConnectionPreference(false);
        handleDriveError(error);
      }
    }
  }, [
    applySourceResults,
    catalogues,
    googleClientId,
    handleDriveError,
    handleSetPaperFormat,
    paperFormat,
    sources,
  ]);

  const handleConnectDrive = useCallback(() => {
    void connectAndSyncDrive("", false);
  }, [connectAndSyncDrive]);

  useEffect(() => {
    if (
      driveRestoreAttempted.current ||
      !restoreDriveOnLoad ||
      !googleDriveConfigured
    ) {
      return;
    }
    driveRestoreAttempted.current = true;
    void connectAndSyncDrive(
      "none",
      true,
      initialDriveSession?.accessToken ?? null,
    );
  }, [
    connectAndSyncDrive,
    googleDriveConfigured,
    initialDriveSession,
    restoreDriveOnLoad,
  ]);

  const handleDisconnectDrive = useCallback(() => {
    driveSession.current += 1;
    queuedDriveSync.current = null;
    lastDriveSyncSignature.current = null;
    setDriveAccessToken(null);
    setDriveAutosync(false);
    setDriveStatus("disconnected");
    setDriveMessage("Drive disconnected. Autosync is off until you reconnect.");
    setDriveConnectionPreference(false);
    clearDriveSessionCredential();
  }, []);

  const handleDownloadDriveBackup = useCallback(async () => {
    if (!driveAccessToken) return;
    const session = driveSession.current;
    setDriveStatus("syncing");
    setDriveMessage("Preparing your Drive backup…");
    try {
      const backup = await downloadDriveBackup(driveAccessToken);
      if (session !== driveSession.current) return;
      if (!backup) {
        throw new Error("No Drive binder backup exists yet.");
      }

      const url = URL.createObjectURL(backup);
      const link = document.createElement("a");
      link.href = url;
      link.download = `paper-mini-foundry-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);

      setDriveStatus("synced");
      setDriveMessage("Backup downloaded. Autosync is still on.");
    } catch (error) {
      if (session !== driveSession.current) return;
      handleDriveError(error);
    }
  }, [driveAccessToken, handleDriveError]);

  const runQueuedDriveSync = useCallback(async () => {
    if (driveSyncInFlight.current) return;
    driveSyncInFlight.current = true;
    try {
      while (queuedDriveSync.current) {
        const payload = queuedDriveSync.current;
        queuedDriveSync.current = null;
        if (
          payload.session !== driveSession.current ||
          payload.accessToken !== driveAccessToken ||
          payload.signature === lastDriveSyncSignature.current
        ) {
          continue;
        }

        setDriveStatus("syncing");
        setDriveMessage("Saving changes to Drive…");
        try {
          const saved = await saveCataloguesToDrive(
            payload.accessToken,
            payload.catalogues,
            payload.paperFormat,
            payload.sources,
          );
          if (
            payload.session !== driveSession.current ||
            payload.accessToken !== driveAccessToken
          ) {
            continue;
          }
          lastDriveSyncSignature.current = createDriveSyncSignature(
            saved.catalogues,
            payload.paperFormat,
            payload.sources,
          );
          applyDriveFileIds(saved.catalogues);
          setDriveStatus("synced");
          setDriveMessage(
            queuedDriveSync.current
              ? "Saving newer changes to Drive…"
              : "All changes saved to Drive.",
          );
        } catch (error) {
          if (payload.session === driveSession.current) {
            queuedDriveSync.current = null;
            handleDriveError(error);
          }
          break;
        }
      }
    } finally {
      driveSyncInFlight.current = false;
    }
  }, [applyDriveFileIds, driveAccessToken, handleDriveError]);

  useEffect(() => {
    if (!driveAutosync || !driveAccessToken) return;
    const signature = createDriveSyncSignature(catalogues, paperFormat, sources);
    if (signature === lastDriveSyncSignature.current) return;

    const timer = window.setTimeout(() => {
      queuedDriveSync.current = {
        accessToken: driveAccessToken,
        catalogues,
        paperFormat,
        session: driveSession.current,
        signature,
        sources,
      };
      void runQueuedDriveSync();
    }, DRIVE_AUTOSYNC_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [
    catalogues,
    driveAccessToken,
    driveAutosync,
    paperFormat,
    runQueuedDriveSync,
    sources,
  ]);

  const handleGenerate = async () => {
    const selected = printableEntries.filter(
      (entry) => entry.quantity > 0 && hasEntryImage(entry),
    );
    setExportError("");
    setGenerating(true);
    try {
      const resolved = await resolveDriveSourceEntries(selected);
      await generatePdf(
        resolved as PrintableMiniFigEntry[],
        paperFormat,
        "paper-minis",
        printLayout,
      );
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Could not generate the PDF.";
      const isCorsError =
        error instanceof DOMException && error.name === "SecurityError";
      setExportError(
        isCorsError
          ? `${message.replace(/[.\s]+$/, "")}. If this is a linked image, check that its host allows CORS.`
          : message,
      );
    } finally {
      setGenerating(false);
    }
  };

  const oversizedCount = printableEntries.filter(
    (entry) =>
      entry.quantity > 0 &&
      hasEntryImage(entry) &&
      isEntryOversized(entry, paperFormat),
  ).length;

  const driveSyncPanel = (
    <GoogleDriveSync
      configured={googleDriveConfigured}
      connected={Boolean(driveAccessToken)}
      status={driveStatus}
      message={driveMessage}
      autosyncEnabled={driveAutosync}
      onConnect={handleConnectDrive}
      onDisconnect={handleDisconnectDrive}
      onDownloadBackup={handleDownloadDriveBackup}
    />
  );

  return (
    <DriveImageProvider accessToken={driveAccessToken}>
    <div className="app">
      <header className="app-header">
        <div>
          <span className="eyebrow">Tabletop toolkit</span>
          <h1>Paper Mini Foundry</h1>
          <p className="subtitle">Build a reusable creature binder, then compose a print sheet.</p>
        </div>
        <Tabs
          className="view-tabs"
          value={view}
          onChange={(_, nextView: AppView) => changeView(nextView)}
          aria-label="App sections"
        >
          <Tab
            value="binder"
            label={<Badge badgeContent={entries.length} color="primary">Binder</Badge>}
          />
          <Tab
            value="print"
            label={<Badge badgeContent={selectedTotal} color="primary">Print</Badge>}
          />
          <Tab
            value="settings"
            className="settings-tab"
            icon={
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path
                  d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.09a2 2 0 0 1 1 1.74v.5a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z"
                />
                <circle cx="12" cy="12" r="3" />
              </svg>
            }
            aria-label="Settings"
          />
        </Tabs>
      </header>

      {view !== "settings" && !driveAccessToken && driveSyncPanel}

      {view === "binder" ? (
        <main className="binder-view">
          <CreatureBinder
            entries={entries}
            sources={sources}
            sourceFilter={sourceFilter}
            onUpdate={updateEntry}
            onRemove={removeEntry}
            onAddCreature={() => openNavigationModal("add-creature")}
            onManageSources={() => openNavigationModal("sources")}
            onRefreshSources={refreshAllSources}
            onSourceFilterChange={changeSourceFilter}
            onPreview={openCreaturePreview}
          />
        </main>
      ) : view === "print" ? (
        <main>
          {oversizedCount > 0 && (
            <div className="oversized-notice">
              <span>⚠️</span>
              <span>{oversizedCount} selected creature{oversizedCount === 1 ? " is" : "s are"} wider than {paperFormat.toUpperCase()}.</span>
            </div>
          )}
          <PrintBuilder
            entries={printableEntries}
            paperFormat={paperFormat}
            printLayout={printLayout}
            generating={generating}
            exportError={exportError}
            onQuantityChange={setQuantity}
            onBlurHash={(id, blurHash) => updateEntry(id, { blurHash })}
            onPreview={openCreaturePreview}
            onQuickAdd={() => openNavigationModal("quick-add")}
            onClearSelection={clearPrintSelection}
            onPaperFormatChange={handleSetPaperFormat}
            onPrintLayoutChange={setPrintLayout}
            onGenerate={handleGenerate}
          />
        </main>
      ) : (
        <main className="settings-view">
          <div className="settings-heading">
            <span className="eyebrow">Application settings</span>
            <h2>Settings</h2>
            <p>Manage cloud storage, backups, and your Google Drive connection.</p>
          </div>
          {driveSyncPanel}
        </main>
      )}

      {activeModal === "add-creature" && (
        <AppModal
          className="creature-dialog"
          ariaLabel="Add creature"
          onClose={() => closeNavigationModal("add-creature")}
        >
          <AddCreatureForm
            uploadEnabled={Boolean(driveAccessToken && driveAutosync)}
            onAdd={handleAddCreature}
            onCancel={() => closeNavigationModal("add-creature")}
          />
        </AppModal>
      )}

      {activeModal === "sources" && (
        <SourceDialog
          sources={sources}
          accessToken={driveAccessToken}
          appId={googleAppId}
          developerKey={googleDeveloperKey}
          pickerConfigured={googlePickerConfigured}
          onAdd={addSource}
          onRefresh={refreshSource}
          onRename={renameSource}
          onRemove={removeSource}
          onClose={() => closeNavigationModal("sources")}
        />
      )}

      {activeModal === "quick-add" && (
        <QuickAddDialog
          entries={printableEntries}
          onAdd={(id) => {
            const entry = printableEntries.find((candidate) => candidate.id === id);
            if (entry) setQuantity(id, entry.quantity + 1);
          }}
          onClose={() => closeNavigationModal("quick-add")}
        />
      )}

      <footer className="app-footer">
        <span>Paper Mini Foundry is an open-source tabletop tool.</span>
        <a
          href="https://github.com/mathiasprisfeldt/paper-mini-fig-generator"
          target="_blank"
          rel="noreferrer"
          aria-label="View Paper Mini Fig Generator on GitHub"
        >
          View source on GitHub
        </a>
      </footer>

      {previewEntry && (
        <ExportPreviewDialog
          key={previewEntry.id}
          entry={previewEntry}
          resolveEntry={resolvePreviewEntry}
          onClose={closeCreaturePreview}
        />
      )}
    </div>
    </DriveImageProvider>
  );
}

export default App;
