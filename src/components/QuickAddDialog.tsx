import { useEffect, useMemo, useState } from "react";
import { DriveCreatureImage } from "../driveImages";
import type { PrintableMiniFigEntry } from "../types";
import { AppModal } from "./AppModal";

interface Props {
  entries: PrintableMiniFigEntry[];
  onAdd: (id: string) => void;
  onClose: () => void;
}

export function QuickAddDialog({ entries, onAdd, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return [...entries]
      .filter((entry) => !normalized || entry.name.toLowerCase().includes(normalized))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, query]);
  const activeIndex = results.length
    ? Math.min(selectedIndex, results.length - 1)
    : 0;
  const activeEntry = results[activeIndex];

  useEffect(() => {
    if (!activeEntry) return;
    document.getElementById(`quick-add-${activeEntry.id}`)?.scrollIntoView({
      block: "nearest",
    });
  }, [activeEntry]);

  const addCreature = (entry: PrintableMiniFigEntry) => {
    onAdd(entry.id);
    setAnnouncement(
      `${entry.name || "Creature"} added · ${entry.quantity + 1} selected`,
    );
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.nativeEvent.isComposing) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (results.length) {
        setSelectedIndex((current) => (current + 1) % results.length);
      }
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length) {
        setSelectedIndex((current) => (current - 1 + results.length) % results.length);
      }
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (activeEntry) addCreature(activeEntry);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (query) {
        setQuery("");
        setSelectedIndex(0);
        setAnnouncement("");
      } else {
        onClose();
      }
    }
  };

  return (
    <AppModal
      className="quick-add-dialog"
      backdropClassName="quick-add-backdrop"
      ariaLabel="Quick add creatures"
      closeOnEscape={false}
      onKeyDown={handleKeyDown}
      onClose={onClose}
    >
        <header className="quick-add-header">
          <div>
            <span className="eyebrow">Print selection</span>
            <h2>Quick add</h2>
          </div>
        </header>

        <input
          className="quick-add-search"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedIndex(0);
            setAnnouncement("");
          }}
          placeholder="Search creatures…"
          role="combobox"
          aria-label="Search creatures to add"
          aria-expanded="true"
          aria-autocomplete="list"
          aria-controls="quick-add-results"
          aria-activedescendant={activeEntry ? `quick-add-${activeEntry.id}` : undefined}
          autoFocus
        />

        <div className="quick-add-shortcuts" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> select</span>
          <span><kbd>Enter</kbd> add</span>
          <span><kbd>Esc</kbd> clear / close</span>
        </div>

        <div className="quick-add-results" id="quick-add-results" role="listbox">
          {results.length ? results.map((entry, index) => (
            <button
              id={`quick-add-${entry.id}`}
              className={`quick-add-result${index === activeIndex ? " active" : ""}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              key={entry.id}
              onMouseEnter={() => setSelectedIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => addCreature(entry)}
            >
              <DriveCreatureImage entry={entry} alt="" />
              <span className="quick-add-result-copy">
                <strong>{entry.name || "Unnamed creature"}</strong>
                <small>{entry.creatureSize} · {entry.miniSize}mm</small>
              </span>
              <span className="quick-add-count">
                {entry.quantity ? `${entry.quantity} selected` : "Add"}
              </span>
            </button>
          )) : (
            <div className="quick-add-empty">
              <strong>No matching creatures</strong>
              <span>Try another search.</span>
            </div>
          )}
        </div>

        <p className="quick-add-announcement" role="status" aria-live="polite">
          {announcement || "Press Enter repeatedly to add more copies."}
        </p>
    </AppModal>
  );
}
