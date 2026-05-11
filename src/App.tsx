import { useState, useCallback } from "react";
import type { MiniFigEntry } from "./types";
import { MiniFigForm } from "./components/MiniFigForm";
import { MiniFigPreview } from "./components/MiniFigPreview";
import { generatePdf } from "./generatePdf";
import "./App.css";

function createEntry(): MiniFigEntry {
  return {
    id: crypto.randomUUID(),
    name: "",
    imageDataUrl: null,
    quantity: 1,
    showName: true,
  };
}

function App() {
  const [entries, setEntries] = useState<MiniFigEntry[]>([createEntry()]);
  const [generating, setGenerating] = useState(false);

  const updateEntry = useCallback(
    (id: string, patch: Partial<MiniFigEntry>) => {
      setEntries((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...patch } : e))
      );
    },
    []
  );

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const addEntry = useCallback(() => {
    setEntries((prev) => [...prev, createEntry()]);
  }, []);

  const handleGenerate = async () => {
    const valid = entries.filter((e) => e.imageDataUrl);
    if (valid.length === 0) return;
    setGenerating(true);
    try {
      await generatePdf(entries);
    } finally {
      setGenerating(false);
    }
  };

  const totalMinis = entries.reduce(
    (sum, e) => sum + (e.imageDataUrl ? e.quantity : 0),
    0
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1>Paper Mini Fig Generator</h1>
        <p className="subtitle">
          Create printable 28mm paper miniatures for your tabletop games
        </p>
      </header>

      <main className="app-main">
        <section className="entries-section">
          <div className="section-header">
            <h2>Miniatures</h2>
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
          <div className="export-info">
            <span>
              {totalMinis} mini{totalMinis !== 1 ? "s" : ""} total
            </span>
            <span className="dot">·</span>
            <span>28mm · Square base · A4 PDF</span>
          </div>
          <button
            className="btn btn-primary btn-large"
            onClick={handleGenerate}
            disabled={generating || totalMinis === 0}
          >
            {generating ? "Generating..." : "Generate PDF"}
          </button>
        </section>
      </main>
    </div>
  );
}

export default App;
