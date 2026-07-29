import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import type {
  CreatureSize,
  CreatureSource,
  MiniFigEntry,
  MiniSize,
  SourceRefreshResult,
} from "../types";
import { useToast } from "../toastContext";
import { CreatureThumbnail } from "./CreatureThumbnail";

interface Props {
  entries: MiniFigEntry[];
  sources: CreatureSource[];
  sourceFilter: string | null;
  onUpdate: (id: string, patch: Partial<MiniFigEntry>) => void;
  onRemove: (id: string) => void;
  onPreview: (id: string) => void;
  onAddCreature: () => void;
  onManageSources: () => void;
  onRefreshSources: () => Promise<SourceRefreshResult>;
  onSourceFilterChange: (sourceId: string | null) => void;
}

const CREATURE_SIZES: CreatureSize[] = [
  "tiny", "small", "medium", "large", "huge", "gargantuan",
];
const MINI_SIZES: MiniSize[] = [24, 28, 32];
const ALL_SOURCES = "";
const MANUAL_SOURCE = "manual";
const ESTIMATED_CARD_HEIGHT = 480;

export function CreatureBinder({
  entries,
  sources,
  sourceFilter,
  onUpdate,
  onRemove,
  onPreview,
  onAddCreature,
  onManageSources,
  onRefreshSources,
  onSourceFilterChange,
}: Props) {
  const { showToast } = useToast();
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const sourceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      const key = entry.sourceId ?? MANUAL_SOURCE;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [entries]);

  const activeSourceFilter =
    !sourceFilter ||
    sourceFilter === MANUAL_SOURCE ||
    sources.some((source) => source.id === sourceFilter)
      ? sourceFilter ?? ALL_SOURCES
      : ALL_SOURCES;

  const gridRef = useRef<HTMLDivElement>(null);
  const lastGridMetrics = useRef({ columnCount: 1, rowGap: 0, scrollMargin: 0 });
  const [{ columnCount, rowGap, scrollMargin }, setGridMetrics] = useState({
    columnCount: 1,
    rowGap: 0,
    scrollMargin: 0,
  });
  const visibleEntries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return [...entries]
      .filter((entry) => {
        const matchesQuery =
          !normalized || entry.name.toLowerCase().includes(normalized);
        const matchesSource =
          activeSourceFilter === ALL_SOURCES ||
          (activeSourceFilter === MANUAL_SOURCE
            ? !entry.sourceId
            : entry.sourceId === activeSourceFilter);
        return matchesQuery && matchesSource;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activeSourceFilter, entries, query]);
  const rows = useMemo(() => {
    const nextRows: MiniFigEntry[][] = [];
    for (let index = 0; index < visibleEntries.length; index += columnCount) {
      nextRows.push(visibleEntries.slice(index, index + columnCount));
    }
    return nextRows;
  }, [columnCount, visibleEntries]);
  const getRowKey = useCallback(
    (index: number) => `${columnCount}:${rows[index]?.[0]?.id ?? index}`,
    [columnCount, rows],
  );
  const rowVirtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => ESTIMATED_CARD_HEIGHT,
    gap: rowGap,
    getItemKey: getRowKey,
    overscan: 2,
    scrollMargin,
  });

  const updateGridMetrics = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const rect = grid.getBoundingClientRect();
    const gridStyles = window.getComputedStyle(grid);
    const resolvedColumns = gridStyles.gridTemplateColumns
      .split(/\s+/)
      .filter(Boolean);
    const nextMetrics = {
      columnCount: Math.max(1, resolvedColumns.length),
      rowGap: Number.parseFloat(gridStyles.rowGap) || 0,
      scrollMargin: rect.top + window.scrollY,
    };
    if (
      lastGridMetrics.current.columnCount === nextMetrics.columnCount
      && lastGridMetrics.current.rowGap === nextMetrics.rowGap
      && lastGridMetrics.current.scrollMargin === nextMetrics.scrollMargin
    ) {
      return;
    }
    lastGridMetrics.current = nextMetrics;
    setGridMetrics(nextMetrics);
  }, []);

  useLayoutEffect(() => {
    updateGridMetrics();
  });

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const resizeObserver = new ResizeObserver(updateGridMetrics);
    resizeObserver.observe(grid);
    window.addEventListener("resize", updateGridMetrics);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateGridMetrics);
    };
  }, [updateGridMetrics]);

  useLayoutEffect(() => {
    rowVirtualizer.measure();
  }, [columnCount, rowVirtualizer, visibleEntries.length]);

  const refreshAllSources = async () => {
    setRefreshing(true);
    try {
      const result = await onRefreshSources();
      showToast({
        tone: "success",
        title: `Refreshed ${sources.length} source${sources.length === 1 ? "" : "s"}`,
        message: `${result.added} added · ${result.removed} removed · ${result.total} total`,
      });
    } catch (caught) {
      showToast({
        tone: "error",
        title: "Source refresh failed",
        message: caught instanceof Error
          ? caught.message
          : "The sources could not be refreshed.",
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <>
    <section className="binder-section">
      <div className="section-toolbar">
        <div className="binder-toolbar-actions">
          <input
            className="search-input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search creatures…"
            aria-label="Search creatures"
          />
          <select
            className="source-filter"
            value={activeSourceFilter}
            onChange={(event) =>
              onSourceFilterChange(event.target.value || null)
            }
            aria-label="Filter creatures by source"
          >
            <option value={ALL_SOURCES}>All creatures ({entries.length})</option>
            <option value={MANUAL_SOURCE}>
              Manually added ({sourceCounts.get(MANUAL_SOURCE) ?? 0})
            </option>
            {sources.map((source) => (
              <option value={source.id} key={source.id}>
                {source.name} ({sourceCounts.get(source.id) ?? 0})
              </option>
            ))}
          </select>
          <div className="source-button-group">
            <button className="btn btn-secondary" onClick={onManageSources}>Sources</button>
            <button
              className="btn btn-secondary source-refresh-button"
              type="button"
              onClick={refreshAllSources}
              disabled={sources.length === 0 || refreshing}
              aria-label="Refresh all sources"
              title={sources.length === 0 ? "Add a source first" : "Refresh all sources"}
            >
              <span className={refreshing ? "refresh-icon spinning" : "refresh-icon"} aria-hidden="true">↻</span>
            </button>
          </div>
          <button className="btn btn-primary" onClick={onAddCreature}>+ Add creature</button>
        </div>
      </div>

      {visibleEntries.length > 0 ? (
        <div
          ref={gridRef}
          className="creature-grid creature-grid-virtual"
          role="list"
          aria-label="Creatures"
          style={{ height: rowVirtualizer.getTotalSize() }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => (
            <div
              ref={rowVirtualizer.measureElement}
              className="creature-grid creature-grid-row"
              data-index={virtualRow.index}
              key={virtualRow.key}
              role="presentation"
              style={{
                transform: `translateY(${virtualRow.start - scrollMargin}px)`,
              }}
            >
              {rows[virtualRow.index].map((entry, columnIndex) => {
                const entryIndex = virtualRow.index * columnCount + columnIndex;
                return (
                  <article
                    className="creature-card"
                    key={entry.id}
                    role="listitem"
                    aria-posinset={entryIndex + 1}
                    aria-setsize={visibleEntries.length}
                  >
                    <CreatureThumbnail
                      className="creature-art"
                      entry={entry}
                      showSelection
                      onPreview={onPreview}
                    />

                    <div className="creature-card-body">
                      <input
                        className="creature-name-input"
                        value={entry.name}
                        onChange={(event) => onUpdate(entry.id, { name: event.target.value })}
                        aria-label="Creature name"
                      />
                      <div className="creature-settings">
                        <label>
                          <span>Size</span>
                          <select
                            value={entry.creatureSize}
                            onChange={(event) => onUpdate(entry.id, { creatureSize: event.target.value as CreatureSize })}
                          >
                            {CREATURE_SIZES.map((size) => (
                              <option key={size} value={size}>{size[0].toUpperCase() + size.slice(1)}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Scale</span>
                          <select
                            value={entry.miniSize}
                            onChange={(event) => onUpdate(entry.id, { miniSize: Number(event.target.value) as MiniSize })}
                          >
                            {MINI_SIZES.map((size) => <option key={size} value={size}>{size}mm</option>)}
                          </select>
                        </label>
                      </div>
                      <label className="card-toggle">
                        <input
                          type="checkbox"
                          checked={entry.showName}
                          onChange={(event) => onUpdate(entry.id, { showName: event.target.checked })}
                        />
                        Show name on base
                      </label>
                      <div className="creature-card-actions">
                        {!entry.sourceId && (
                          <button className="btn btn-danger-ghost" onClick={() => onRemove(entry.id)}>
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span>◇</span>
          <h3>{entries.length ? "No matching creatures" : "Your binder is empty"}</h3>
          <p>{entries.length ? "Try another search or source filter." : "Add a creature manually or connect an HTML source."}</p>
        </div>
      )}
    </section>
    </>
  );
}
