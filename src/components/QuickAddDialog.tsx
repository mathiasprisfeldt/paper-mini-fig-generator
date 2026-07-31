import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { ButtonBase, TextField } from "@mui/material";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { PrintableMiniFigEntry } from "../types";
import { AppModal } from "./AppModal";
import { CreatureThumbnail } from "./CreatureThumbnail";

interface Props {
  entries: PrintableMiniFigEntry[];
  onAdd: (id: string) => void;
  onClose: () => void;
}

const ESTIMATED_RESULT_HEIGHT = 64;
const RESULT_GAP = 6;

export function QuickAddDialog({ entries, onAdd, onClose }: Props) {
  const [resultsElement, setResultsElement] = useState<HTMLDivElement | null>(null);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [activeDescendantId, setActiveDescendantId] = useState<string>();
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
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual is the established list virtualizer in this app.
  const resultVirtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => resultsElement,
    estimateSize: () => ESTIMATED_RESULT_HEIGHT,
    gap: RESULT_GAP,
    overscan: 6,
    getItemKey: (index) => results[index]?.id ?? index,
  });
  const virtualResults = resultVirtualizer.getVirtualItems();
  const activeOptionId = activeEntry ? `quick-add-${activeEntry.id}` : undefined;
  const activeOptionMounted = virtualResults.some(
    (virtualResult) => virtualResult.index === activeIndex,
  );

  useLayoutEffect(() => {
    resultVirtualizer.measure();
  }, [resultVirtualizer, results.length]);

  useLayoutEffect(() => {
    if (!activeOptionId) {
      setActiveDescendantId(undefined);
    } else if (activeOptionMounted) {
      setActiveDescendantId(activeOptionId);
    }
  }, [activeOptionId, activeOptionMounted]);

  useEffect(() => {
    if (!activeEntry) return;
    resultVirtualizer.scrollToIndex(activeIndex, { align: "auto" });
  }, [activeEntry, activeIndex, resultVirtualizer]);

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
              "aria-activedescendant": activeDescendantId,
            },
          }}
        />

        <div className="quick-add-shortcuts" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> select</span>
          <span><kbd>Enter</kbd> add</span>
          <span><kbd>Esc</kbd> clear / close</span>
        </div>

        <div
          ref={setResultsElement}
          className="quick-add-results"
          id="quick-add-results"
          role="listbox"
        >
          {results.length ? (
            <div
              className="quick-add-results-virtual"
              role="presentation"
              style={{ height: resultVirtualizer.getTotalSize() }}
            >
              {virtualResults.map((virtualResult) => {
                const entry = results[virtualResult.index];
                const index = virtualResult.index;
                return (
                  <ButtonBase
                    ref={resultVirtualizer.measureElement}
                    id={`quick-add-${entry.id}`}
                    className={`quick-add-result${index === activeIndex ? " active" : ""}`}
                    component="button"
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    aria-posinset={index + 1}
                    aria-setsize={results.length}
                    data-index={index}
                    key={entry.id}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => addCreature(entry)}
                    sx={{
                      display: "grid",
                      position: "absolute",
                      top: 0,
                      left: 0,
                      transform: `translateY(${virtualResult.start}px)`,
                    }}
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
              })}
            </div>
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
