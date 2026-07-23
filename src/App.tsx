import { useCallback, useEffect, useRef, useState } from "react";
import type { Catalogue, CreatureSource, MiniFigEntry, PaperFormat } from "./types";
import { AddCreatureForm } from "./components/AddCreatureForm";
import { AppModal } from "./components/AppModal";
import { CreatureBinder } from "./components/CreatureBinder";
import { ExportPreviewDialog } from "./components/ExportPreviewDialog";
import { PrintBuilder } from "./components/PrintBuilder";
import { QuickAddDialog } from "./components/QuickAddDialog";
import { SourceDialog, type SourceDraft } from "./components/SourceDialog";
import {
  GoogleDriveSync,
  type DriveSyncStatus,
} from "./components/GoogleDriveSync";
import { generatePdf, getEntryImageSource, isEntryOversized } from "./generatePdf";
import { discoverSourceCreatures, type DiscoveredCreature } from "./sourceDiscovery";
import {
  connectGoogleDrive,
  discoverDriveFolderCreatures,
  DriveAuthError,
  loadCataloguesFromDrive,
  saveCataloguesToDrive,
} from "./googleDrive";
import {
  createCatalogue,
  getPaperFormat,
  loadSources,
  loadCatalogues,
  saveCatalogues,
  saveSources,
  setPaperFormat as savePaperFormat,
} from "./storage";
import "./App.css";

type AppView = "binder" | "print";
type AppModalId = "add-creature" | "sources" | "quick-add";
const PREVIEW_QUERY_PARAM = "preview";
const MODAL_QUERY_PARAM = "modal";
const APP_MODALS: AppModalId[] = ["add-creature", "sources", "quick-add"];

function getModalFromUrl(): AppModalId | null {
  const modal = new URL(window.location.href).searchParams.get(MODAL_QUERY_PARAM);
  return APP_MODALS.includes(modal as AppModalId) ? modal as AppModalId : null;
}

function normalizeAsBinder(catalogues: Catalogue[]): Catalogue[] {
  if (catalogues.length === 0) return [createCatalogue("Creature Binder")];

  const seen = new Set<string>();
  const entries = catalogues.flatMap((catalogue) => catalogue.entries).filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
  const createdAt = Math.min(...catalogues.map((catalogue) => catalogue.createdAt));
  const updatedAt = Math.max(...catalogues.map((catalogue) => catalogue.updatedAt));

  return [{
    id: catalogues[0].id,
    name: "Creature Binder",
    entries,
    createdAt,
    updatedAt,
  }];
}

function hasNewDriveFileIds(before: Catalogue[], after: Catalogue[]): boolean {
  const previousIds = new Map(
    before.flatMap((catalogue) =>
      catalogue.entries.map((entry) => [entry.id, entry.imageDriveFileId] as const),
    ),
  );
  return after.some((catalogue) =>
    catalogue.entries.some(
      (entry) => Boolean(entry.imageDriveFileId) && entry.imageDriveFileId !== previousIds.get(entry.id),
    ),
  );
}

function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? "";
  const googleAppId = import.meta.env.VITE_GOOGLE_APP_ID?.trim() ?? "";
  const googleDeveloperKey = import.meta.env.VITE_GOOGLE_API_KEY?.trim() ?? "";
  const googleDriveConfigured = Boolean(googleClientId);
  const googlePickerConfigured = Boolean(googleClientId && googleAppId && googleDeveloperKey);
  const [catalogues, setCatalogues] = useState<Catalogue[]>(() =>
    normalizeAsBinder(loadCatalogues()),
  );
  const [view, setView] = useState<AppView>("binder");
  const [activeModal, setActiveModal] = useState<AppModalId | null>(getModalFromUrl);
  const [previewId, setPreviewId] = useState<string | null>(() =>
    new URL(window.location.href).searchParams.get(PREVIEW_QUERY_PARAM),
  );
  const [sources, setSources] = useState<CreatureSource[]>(loadSources);
  const [paperFormat, setPaperFormatState] = useState<PaperFormat>(getPaperFormat);
  const [generating, setGenerating] = useState(false);
  const [exportError, setExportError] = useState("");
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(null);
  const [driveStatus, setDriveStatus] = useState<DriveSyncStatus>("disconnected");
  const [driveMessage, setDriveMessage] = useState(
    googleDriveConfigured
      ? "Connect your account to sync the binder, print choices, and uploaded images."
      : "Set the Google client ID to enable Drive sync.",
  );
  const [driveAutosync, setDriveAutosync] = useState(false);
  const skipNextAutosync = useRef(false);
  const driveSession = useRef(0);
  const initialSourcesRefreshed = useRef(false);

  const entries = catalogues[0]?.entries ?? [];
  const selectedTotal = entries.reduce((sum, entry) => sum + entry.quantity, 0);
  const previewEntry = entries.find((entry) => entry.id === previewId) ?? null;

  useEffect(() => {
    const syncNavigationFromHistory = () => {
      const url = new URL(window.location.href);
      setPreviewId(url.searchParams.get(PREVIEW_QUERY_PARAM));
      setActiveModal(getModalFromUrl());
    };
    window.addEventListener("popstate", syncNavigationFromHistory);
    return () => window.removeEventListener("popstate", syncNavigationFromHistory);
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
              sourceId: source.id,
            }
          : {
              id: item.id,
              name: item.name,
              imageDataUrl: item.imageDataUrl,
              imageUrl: item.imageUrl,
              imageDriveFileId: item.imageDriveFileId,
              sourceId: source.id,
              quantity: 0,
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
    applySourceResults(source, discovered);
    return discovered.length;
  }, [applySourceResults, driveAccessToken]);

  const refreshAllSources = useCallback(async () => {
    const results = await Promise.allSettled(sources.map(refreshSource));
    const successful = results.filter((result) => result.status === "fulfilled");
    const failed = results.filter((result) => result.status === "rejected");
    const creatureCount = successful.reduce((sum, result) => sum + result.value, 0);

    if (failed.length > 0) {
      const firstError = failed[0].reason instanceof Error
        ? failed[0].reason.message
        : "A source could not be refreshed.";
      throw new Error(
        `${successful.length} of ${sources.length} sources refreshed. ${firstError}`,
      );
    }

    return creatureCount;
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
    if (discovered.length === 0) {
      throw new Error(source.type === "html"
        ? "The selector did not find any links to supported image files."
        : "That Drive folder does not contain any supported image files.");
    }
    setSources((current) => [...current, source]);
    applySourceResults(source, discovered);
    return discovered.length;
  }, [applySourceResults, driveAccessToken, sources]);

  const removeSource = useCallback((source: CreatureSource) => {
    setSources((current) => current.filter((saved) => saved.id !== source.id));
    setEntries((current) => current.filter((entry) => entry.sourceId !== source.id));
  }, [setEntries]);

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
    updateEntry(id, { quantity: Math.min(99, Math.max(0, Math.round(quantity) || 0)) });
  }, [updateEntry]);

  const clearPrintSelection = useCallback(() => {
    setEntries((current) => current.map((entry) =>
      entry.quantity === 0 ? entry : { ...entry, quantity: 0 },
    ));
  }, [setEntries]);

  const handleSetPaperFormat = useCallback((format: PaperFormat) => {
    setPaperFormatState(format);
    savePaperFormat(format);
  }, []);

  const applyDriveFileIds = useCallback((saved: Catalogue[]) => {
    const fileIds = new Map(
      saved.flatMap((catalogue) =>
        catalogue.entries.map((entry) => [entry.id, entry.imageDriveFileId] as const),
      ),
    );
    setEntries((current) => current.map((entry) => {
      const imageDriveFileId = fileIds.get(entry.id) ?? null;
      return imageDriveFileId === entry.imageDriveFileId
        ? entry
        : { ...entry, imageDriveFileId };
    }));
  }, [setEntries]);

  const handleDriveError = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : "Google Drive sync failed.";
    setDriveStatus("error");
    setDriveMessage(message);
    if (error instanceof DriveAuthError) {
      setDriveAccessToken(null);
      setDriveAutosync(false);
    }
  }, []);

  const handleAddCreature = useCallback(async (entry: MiniFigEntry) => {
    if (!entry.imageDataUrl) {
      addEntry(entry);
      closeNavigationModal("add-creature");
      return;
    }
    if (!driveAccessToken || !driveAutosync) {
      throw new Error("Connect Google Drive and load or save your binder before uploading images.");
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
      skipNextAutosync.current = true;
      setCatalogues(normalizeAsBinder(saved.catalogues));
      setDriveStatus("synced");
      setDriveMessage("Creature uploaded. All changes saved to Drive.");
      closeNavigationModal("add-creature");
    } catch (error) {
      handleDriveError(error);
      throw error;
    }
  }, [addEntry, catalogues, closeNavigationModal, driveAccessToken, driveAutosync, handleDriveError, paperFormat, sources]);

  const handleConnectDrive = useCallback(async () => {
    setDriveStatus("connecting");
    setDriveMessage("Waiting for Google authorization…");
    try {
      const accessToken = await connectGoogleDrive(googleClientId);
      setDriveAccessToken(accessToken);
      setDriveStatus("connected");
      setDriveMessage("Connected. Load your binder or save this browser's binder.");
      for (const source of sources.filter((candidate) => candidate.type === "drive")) {
        void discoverDriveFolderCreatures(accessToken, source)
          .then((discovered) => applySourceResults(source, discovered))
          .catch(() => {
            // The folder may need to be selected again if its Picker grant expired.
          });
      }
    } catch (error) {
      handleDriveError(error);
    }
  }, [applySourceResults, googleClientId, handleDriveError, sources]);

  const handleDisconnectDrive = useCallback(() => {
    driveSession.current += 1;
    setDriveAccessToken(null);
    setDriveAutosync(false);
    setDriveStatus("disconnected");
    setDriveMessage("Drive disconnected. Autosync is off until you reconnect.");
  }, []);

  const handleLoadFromDrive = useCallback(async () => {
    if (!driveAccessToken) return;
    const session = driveSession.current;
    setDriveStatus("syncing");
    setDriveMessage("Downloading binder and uploaded images…");
    try {
      const remote = await loadCataloguesFromDrive(driveAccessToken);
      if (session !== driveSession.current) return;
      if (!remote) {
        setDriveStatus("connected");
        setDriveMessage("No Drive binder exists yet. Use Save to Drive to create one.");
        return;
      }
      skipNextAutosync.current = true;
      setCatalogues(normalizeAsBinder(remote.catalogues));
      setSources(remote.sources);
      if (remote.paperFormat) handleSetPaperFormat(remote.paperFormat);
      setDriveAutosync(true);
      setDriveStatus("synced");
      setDriveMessage("Binder loaded. Future changes will sync automatically.");
    } catch (error) {
      if (session !== driveSession.current) return;
      handleDriveError(error);
    }
  }, [driveAccessToken, handleDriveError, handleSetPaperFormat]);

  const handleSaveToDrive = useCallback(async () => {
    if (!driveAccessToken) return;
    const session = driveSession.current;
    setDriveStatus("syncing");
    setDriveMessage("Uploading binder and new images…");
    try {
      const saved = await saveCataloguesToDrive(driveAccessToken, catalogues, paperFormat, sources);
      if (session !== driveSession.current) return;
      skipNextAutosync.current = !driveAutosync || hasNewDriveFileIds(catalogues, saved.catalogues);
      applyDriveFileIds(saved.catalogues);
      setDriveAutosync(true);
      setDriveStatus("synced");
      setDriveMessage("Binder saved. Future changes will sync automatically.");
    } catch (error) {
      if (session !== driveSession.current) return;
      handleDriveError(error);
    }
  }, [applyDriveFileIds, catalogues, driveAccessToken, driveAutosync, handleDriveError, paperFormat, sources]);

  useEffect(() => {
    if (!driveAutosync || !driveAccessToken) return;
    if (skipNextAutosync.current) {
      skipNextAutosync.current = false;
      return;
    }

    setDriveStatus("syncing");
    setDriveMessage("Saving changes to Drive…");
    const timer = window.setTimeout(async () => {
      const session = driveSession.current;
      try {
        const saved = await saveCataloguesToDrive(driveAccessToken, catalogues, paperFormat, sources);
        if (session !== driveSession.current) return;
        skipNextAutosync.current = hasNewDriveFileIds(catalogues, saved.catalogues);
        applyDriveFileIds(saved.catalogues);
        setDriveStatus("synced");
        setDriveMessage("All changes saved to Drive.");
      } catch (error) {
        if (session !== driveSession.current) return;
        handleDriveError(error);
      }
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [applyDriveFileIds, catalogues, driveAccessToken, driveAutosync, handleDriveError, paperFormat, sources]);

  const handleGenerate = async () => {
    const selected = entries.filter((entry) => entry.quantity > 0 && getEntryImageSource(entry));
    setExportError("");
    setGenerating(true);
    try {
      await generatePdf(selected, paperFormat, "paper-minis");
    } catch (error) {
      setExportError(
        error instanceof Error
          ? `${error.message}. If this is a linked image, check that its host allows CORS.`
          : "Could not generate the PDF.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const oversizedCount = entries.filter(
    (entry) => entry.quantity > 0 && isEntryOversized(entry, paperFormat),
  ).length;

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <span className="eyebrow">Tabletop toolkit</span>
          <h1>Paper Mini Foundry</h1>
          <p className="subtitle">Build a reusable creature binder, then compose a print sheet.</p>
        </div>
        <nav className="view-tabs" aria-label="App sections">
          <button className={view === "binder" ? "active" : ""} onClick={() => setView("binder")}>
            Binder <span>{entries.length}</span>
          </button>
          <button className={view === "print" ? "active" : ""} onClick={() => setView("print")}>
            Print sheet <span>{selectedTotal}</span>
          </button>
        </nav>
      </header>

      <GoogleDriveSync
        configured={googleDriveConfigured}
        connected={Boolean(driveAccessToken)}
        status={driveStatus}
        message={driveMessage}
        autosyncEnabled={driveAutosync}
        onConnect={handleConnectDrive}
        onDisconnect={handleDisconnectDrive}
        onLoad={handleLoadFromDrive}
        onSave={handleSaveToDrive}
      />

      {view === "binder" ? (
        <main className="binder-view">
          <CreatureBinder
            entries={entries}
            sources={sources}
            onUpdate={updateEntry}
            onRemove={removeEntry}
            onAddCreature={() => openNavigationModal("add-creature")}
            onManageSources={() => openNavigationModal("sources")}
            onRefreshSources={refreshAllSources}
            onPreview={openCreaturePreview}
          />
        </main>
      ) : (
        <main>
          {oversizedCount > 0 && (
            <div className="oversized-notice">
              <span>⚠️</span>
              <span>{oversizedCount} selected creature{oversizedCount === 1 ? " is" : "s are"} wider than {paperFormat.toUpperCase()}.</span>
            </div>
          )}
          <PrintBuilder
            entries={entries}
            paperFormat={paperFormat}
            generating={generating}
            exportError={exportError}
            onQuantityChange={setQuantity}
            onPreview={openCreaturePreview}
            onQuickAdd={() => openNavigationModal("quick-add")}
            onClearSelection={clearPrintSelection}
            onPaperFormatChange={handleSetPaperFormat}
            onGenerate={handleGenerate}
          />
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
          clientId={googleClientId}
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
          entries={entries}
          onAdd={(id) => {
            const entry = entries.find((candidate) => candidate.id === id);
            if (entry) setQuantity(id, entry.quantity + 1);
          }}
          onClose={() => closeNavigationModal("quick-add")}
        />
      )}

      {previewEntry && (
        <ExportPreviewDialog
          key={previewEntry.id}
          entry={previewEntry}
          onClose={closeCreaturePreview}
        />
      )}
    </div>
  );
}

export default App;
