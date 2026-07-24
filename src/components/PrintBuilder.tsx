import { useMemo, useState } from "react";
import type { MiniFigEntry, PaperFormat } from "../types";
import { CreatureThumbnail } from "./CreatureThumbnail";

interface Props {
  entries: MiniFigEntry[];
  paperFormat: PaperFormat;
  generating: boolean;
  exportError: string;
  onQuantityChange: (id: string, quantity: number) => void;
  onPreview: (id: string) => void;
  onQuickAdd: () => void;
  onClearSelection: () => void;
  onPaperFormatChange: (format: PaperFormat) => void;
  onGenerate: () => void;
}

export function PrintBuilder({
  entries,
  paperFormat,
  generating,
  exportError,
  onQuantityChange,
  onPreview,
  onQuickAdd,
  onClearSelection,
  onPaperFormatChange,
  onGenerate,
}: Props) {
  const [query, setQuery] = useState("");
  const total = entries.reduce((sum, entry) => sum + entry.quantity, 0);
  const selectedKinds = entries.filter((entry) => entry.quantity > 0).length;
  const visibleEntries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return [...entries]
      .filter((entry) => !normalized || entry.name.toLowerCase().includes(normalized))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, query]);

  return (
    <>
    <div className="print-layout">
      <section className="print-picker">
        <div className="section-toolbar">
          <div>
            <span className="eyebrow">Print selection</span>
            <h2>Choose your creatures</h2>
            <p>Set zero to leave a creature out of this print.</p>
          </div>
          <div className="print-toolbar-actions">
            <input
              className="search-input print-search-input"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search creatures…"
              aria-label="Search print creatures"
            />
            <button
              className="btn btn-secondary"
              type="button"
              onClick={onQuickAdd}
              disabled={entries.length === 0}
            >
              Quick add
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={onClearSelection}
              disabled={total === 0}
            >
              Clear selection
            </button>
          </div>
        </div>

        {visibleEntries.length > 0 ? (
          <div className="print-creature-list">
            {visibleEntries.map((entry) => (
              <article className={`print-creature-row${entry.quantity ? " selected" : ""}`} key={entry.id}>
                <CreatureThumbnail
                  className="print-creature-thumbnail"
                  entry={entry}
                  showHint={false}
                  onPreview={onPreview}
                />
                <div className="print-creature-info">
                  <strong>{entry.name || "Unnamed creature"}</strong>
                  <span>{entry.creatureSize} · {entry.miniSize}mm</span>
                </div>
                <div className="quantity-stepper" aria-label={`${entry.name} quantity`}>
                  <button
                    type="button"
                    aria-label={`Decrease ${entry.name || "unnamed creature"} quantity`}
                    onClick={() => onQuantityChange(entry.id, entry.quantity - 1)}
                    disabled={entry.quantity === 0}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    aria-label={`${entry.name || "Unnamed creature"} quantity`}
                    min={0}
                    max={99}
                    value={entry.quantity}
                    onChange={(event) => onQuantityChange(entry.id, Number(event.target.value))}
                  />
                  <button
                    type="button"
                    aria-label={`Increase ${entry.name || "unnamed creature"} quantity`}
                    onClick={() => onQuantityChange(entry.id, entry.quantity + 1)}
                    disabled={entry.quantity >= 99}
                  >
                    +
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="empty-state compact">
            <h3>Add creatures to your binder first</h3>
          </div>
        ) : (
          <div className="empty-state compact">
            <h3>No matching creatures</h3>
            <p>Try another search.</p>
          </div>
        )}
      </section>

      <aside className="print-summary">
        <span className="eyebrow">Export</span>
        <h2>Print sheet</h2>
        <div className="summary-stat">
          <strong>{total}</strong>
          <span>miniature{total === 1 ? "" : "s"}</span>
        </div>
        <p>{selectedKinds} unique creature{selectedKinds === 1 ? "" : "s"}</p>

        <div className="paper-format-control">
          <span>Paper size</span>
          <div className="format-picker">
            {(["a4", "a3"] as PaperFormat[]).map((format) => (
              <button
                key={format}
                className={`format-btn${paperFormat === format ? " active" : ""}`}
                onClick={() => onPaperFormatChange(format)}
              >
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {exportError && <p className="form-error">{exportError}</p>}
        <button
          className="btn btn-primary btn-large export-button"
          onClick={onGenerate}
          disabled={generating || total === 0}
        >
          {generating ? "Generating PDF…" : "Export PDF"}
        </button>
      </aside>
    </div>
    </>
  );
}
