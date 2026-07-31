import { useEffect, useMemo, useRef, useState } from "react";
import { ButtonBase, TextField } from "@mui/material";
import { AutoSizer, List } from "react-virtualized";
import type { PrintableMiniFigEntry } from "../types";
import { AppModal } from "./AppModal";
import { CreatureThumbnail } from "./CreatureThumbnail";

interface Props {
  entries: PrintableMiniFigEntry[];
  onAdd: (id: string) => void;
  onClose: () => void;
}

export function QuickAddDialog({ entries, onAdd, onClose }: Props) {
  const resultsListRef = useRef<List>(null);
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
  const activeOptionId = activeEntry ? `quick-add-${activeEntry.id}` : undefined;

  useEffect(() => {
    if (activeOptionId) {
      resultsListRef.current?.scrollToRow(activeIndex);
    }
  }, [activeIndex, activeOptionId]);

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
  };

  return (
    <AppModal
      className="quick-add-dialog"
      backdropClassName="quick-add-backdrop"
      ariaLabel="Quick add creatures"
      onKeyDown={handleKeyDown}
      onClose={onClose}
    >
        <header className="quick-add-header">
          <div>
            <span className="eyebrow">Print selection</span>
            <h2>Quick add</h2>
          </div>
        </header>

        <TextField
          className="quick-add-search"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedIndex(0);
            setAnnouncement("");
          }}
          placeholder="Search creatures…"
          fullWidth
          autoFocus
          sx={{
            "& .MuiOutlinedInput-input": {
              padding: "0.78rem 0.9rem",
              fontSize: "1rem",
            },
          }}
          slotProps={{
            htmlInput: {
              role: "combobox",
              "aria-label": "Search creatures to add",
              "aria-expanded": "true",
              "aria-autocomplete": "list",
              "aria-controls": "quick-add-results",
              "aria-activedescendant": activeOptionId,
            },
          }}
        />

        <div className="quick-add-shortcuts" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> select</span>
          <span><kbd>Enter</kbd> add</span>
          <span><kbd>Esc</kbd> close</span>
        </div>

        <div
          className="quick-add-results"
          id="quick-add-results"
          role="listbox"
        >
          {results.length ? (
            <AutoSizer>
              {({ height, width }) => (
                <List
                  ref={resultsListRef}
                  height={height}
                  overscanRowCount={6}
                  rowCount={results.length}
                  rowHeight={64}
                  rowRenderer={({ index, key, style }) => {
                    const entry = results[index];
                    return (
                      <ButtonBase
                        id={`quick-add-${entry.id}`}
                        className={`quick-add-result${index === activeIndex ? " active" : ""}`}
                        component="button"
                        type="button"
                        role="option"
                        aria-selected={index === activeIndex}
                        aria-posinset={index + 1}
                        aria-setsize={results.length}
                        key={key}
                        style={style}
                        onMouseEnter={() => setSelectedIndex(index)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => addCreature(entry)}
                        sx={{ display: "grid" }}
                      >
                        <CreatureThumbnail
                          className="quick-add-thumbnail"
                          entry={entry}
                          imageLoading="eager"
                          interactive={false}
                          showHint={false}
                        />
                        <span className="quick-add-result-copy">
                          <strong>{entry.name || "Unnamed creature"}</strong>
                          <small>{entry.creatureSize} · {entry.miniSize}mm</small>
                        </span>
                        <span className="quick-add-count">
                          {entry.quantity ? `${entry.quantity} selected` : "Add"}
                        </span>
                      </ButtonBase>
                    );
                  }}
                  width={width}
                />
              )}
            </AutoSizer>
          ) : (
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
