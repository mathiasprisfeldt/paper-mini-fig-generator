import { useState, useCallback, useEffect } from "react";
import type { MiniFigEntry, Catalogue, PaperFormat } from "./types";
import { MiniFigForm } from "./components/MiniFigForm";
import { MiniFigPreview } from "./components/MiniFigPreview";
import { CataloguePanel } from "./components/CataloguePanel";
import { generatePdf, isEntryOversized } from "./generatePdf";
import {
  loadCatalogues,
  saveCatalogues,
  getActiveCatalogueId,
  setActiveCatalogueId,
  createCatalogue,
} from "./storage";
import "./App.css";

const MAX_OVERSIZED_NAMES = 3;

function formatOversizedNames(items: MiniFigEntry[]): string {
  const names = items.map((e) => e.name || "Unnamed");
  const shown = names.slice(0, MAX_OVERSIZED_NAMES).join(", ");
  const extra = names.length - MAX_OVERSIZED_NAMES;
  return extra > 0 ? `${shown} and ${extra} more` : shown;
}

function createEntry(): MiniFigEntry {
  return {
    id: crypto.randomUUID(),
    name: "",
    imageDataUrl: null,
    quantity: 1,
    showName: true,
    miniSize: 28,
    creatureSize: "medium",
  };
}

function App() {
  const [catalogues, setCatalogues] = useState<Catalogue[]>(() => {
    const saved = loadCatalogues();
    if (saved.length === 0) {
      const initial = createCatalogue("My First Catalogue", [createEntry()]);
      return [initial];
    }
    return saved;
  });

  const [activeCatalogueId, setActiveCatalogueIdState] = useState<
    string | null
  >(() => {
    const savedId = getActiveCatalogueId();
    // Reuse catalogues initializer logic: if saved was empty, a default was created
    // so we just check against what we'd return from the catalogues initializer
    const saved = loadCatalogues();
    if (savedId && saved.some((c) => c.id === savedId)) return savedId;
    if (saved.length > 0) return saved[0].id;
    return null;
  });

  // Derive a valid activeCatalogueId without using setState in an effect
  const resolvedActiveCatalogueId =
    activeCatalogueId && catalogues.some((c) => c.id === activeCatalogueId)
      ? activeCatalogueId
      : catalogues.length > 0
        ? catalogues[0].id
        : null;

  // Persist catalogues whenever they change
  useEffect(() => {
    saveCatalogues(catalogues);
  }, [catalogues]);

  // Persist active catalogue id
  useEffect(() => {
    setActiveCatalogueId(resolvedActiveCatalogueId);
  }, [resolvedActiveCatalogueId]);

  const [generating, setGenerating] = useState(false);
  const [paperFormat, setPaperFormat] = useState<PaperFormat>("a4");

  const activeCatalogue = catalogues.find(
    (c) => c.id === resolvedActiveCatalogueId
  );
  const entries = activeCatalogue?.entries ?? [];

  const setEntries = useCallback(
    (updater: (prev: MiniFigEntry[]) => MiniFigEntry[]) => {
      setCatalogues((prev) =>
        prev.map((c) =>
          c.id === resolvedActiveCatalogueId
            ? { ...c, entries: updater(c.entries), updatedAt: Date.now() }
            : c
        )
      );
    },
    [resolvedActiveCatalogueId]
  );

  const updateEntry = useCallback(
    (id: string, patch: Partial<MiniFigEntry>) => {
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
      );
    },
    [setEntries]
  );

  const removeEntry = useCallback(
    (id: string) => {
      setEntries((prev) => prev.filter((e) => e.id !== id));
    },
    [setEntries]
  );

  const addEntry = useCallback(() => {
    setEntries((prev) => [...prev, createEntry()]);
  }, [setEntries]);

  const handleGenerate = async () => {
    const valid = entries.filter((e) => e.imageDataUrl);
    if (valid.length === 0) return;
    setGenerating(true);
    try {
      await generatePdf(entries, paperFormat);
    } finally {
      setGenerating(false);
    }
  };

  // Catalogue management
  const handleCreateCatalogue = (name: string) => {
    const newCat = createCatalogue(name, [createEntry()]);
    setCatalogues((prev) => [...prev, newCat]);
    setActiveCatalogueIdState(newCat.id);
  };

  const handleSelectCatalogue = (id: string) => {
    setActiveCatalogueIdState(id);
  };

  const handleRenameCatalogue = (id: string, name: string) => {
    setCatalogues((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name, updatedAt: Date.now() } : c))
    );
  };

  const handleDeleteCatalogue = (id: string) => {
    setCatalogues((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (next.length === 0) {
        const fallback = createCatalogue("My Catalogue", [createEntry()]);
        return [fallback];
      }
      return next;
    });
  };

  const handleDuplicateCatalogue = (id: string) => {
    const source = catalogues.find((c) => c.id === id);
    if (!source) return;
    const dup = createCatalogue(
      `${source.name} (Copy)`,
      source.entries.map((e) => ({ ...e, id: crypto.randomUUID() }))
    );
    setCatalogues((prev) => [...prev, dup]);
    setActiveCatalogueIdState(dup.id);
  };

  const totalMinis = entries.reduce(
    (sum, e) => sum + (e.imageDataUrl ? e.quantity : 0),
    0
  );

  const oversizedEntries = entries.filter(
    (e) => e.imageDataUrl && isEntryOversized(e, paperFormat)
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1>Paper Mini Fig Generator</h1>
        <p className="subtitle">
          Create printable 28mm paper miniatures for your tabletop games
        </p>
      </header>

      <div className="app-layout">
        <CataloguePanel
          catalogues={catalogues}
          activeCatalogueId={resolvedActiveCatalogueId}
          onSelect={handleSelectCatalogue}
          onCreate={handleCreateCatalogue}
          onRename={handleRenameCatalogue}
          onDelete={handleDeleteCatalogue}
          onDuplicate={handleDuplicateCatalogue}
        />

        <main className="app-main">
          {activeCatalogue && (
            <>
              <section className="entries-section">
                <div className="section-header">
                  <h2>{activeCatalogue.name}</h2>
                  <button className="btn btn-secondary" onClick={addEntry}>
                    + Add Miniature
                  </button>
                </div>

                <div className="entries-list">
                  {entries.map((entry) => (
                    <div key={entry.id} className="entry-row">
                      <MiniFigForm
                        entry={entry}
                        onUpdate={(patch) => updateEntry(entry.id, patch)}
                        onRemove={
                          entries.length > 1
                            ? () => removeEntry(entry.id)
                            : undefined
                        }
                      />
                      <MiniFigPreview entry={entry} />
                    </div>
                  ))}
                </div>
              </section>

              <section className="export-section">
                {oversizedEntries.length > 0 && (
                  <div className="oversized-notice">
                    <span className="oversized-notice-icon">⚠️</span>
                    <span>
                      {formatOversizedNames(oversizedEntries)}{" "}
                      {oversizedEntries.length === 1 ? "exceeds" : "exceed"} the{" "}
                      {paperFormat.toUpperCase()} page width.
                      {paperFormat === "a4" && " Try switching to A3."}
                    </span>
                  </div>
                )}
                <div className="export-controls">
                  <div className="export-info">
                    <span>
                      {totalMinis} mini{totalMinis !== 1 ? "s" : ""} total
                    </span>
                    <span className="dot">·</span>
                    <span>Square base</span>
                    <span className="dot">·</span>
                    <div className="format-picker">
                      {(["a4", "a3"] as PaperFormat[]).map((f) => (
                        <button
                          key={f}
                          className={`format-btn${paperFormat === f ? " active" : ""}`}
                          onClick={() => setPaperFormat(f)}
                        >
                          {f.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <span>PDF</span>
                  </div>
                  <button
                    className="btn btn-primary btn-large"
                    onClick={handleGenerate}
                    disabled={generating || totalMinis === 0}
                  >
                    {generating ? "Generating..." : "Generate PDF"}
                  </button>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;

