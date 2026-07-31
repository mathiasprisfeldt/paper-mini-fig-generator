import {
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AutoSizer,
  List,
  WindowScroller,
} from "react-virtualized";
import type {
  CreatureSize,
  CreatureSource,
  MiniFigEntry,
  MiniSize,
  SourceRefreshResult,
} from "../types";
import { useToast } from "../toastContext";
import { CreatureSearch } from "./CreatureSearch";
import { CreatureThumbnail } from "./CreatureThumbnail";
import {
  Button,
} from "@mui/material";

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
const CARD_MIN_WIDTH = 230;
const GRID_GAP = 8;
const INITIAL_ROW_HEIGHT_ESTIMATE = 400;

interface CreatureBinderCardProps {
  entry: MiniFigEntry;
  entryIndex: number;
  entriesCount: number;
  loadedImageKeys: Set<string>;
  onUpdate: (id: string, patch: Partial<MiniFigEntry>) => void;
  onRemove: (id: string) => void;
  onPreview: (id: string) => void;
}

const CreatureBinderCard = memo(function CreatureBinderCard({
  entry,
  entryIndex,
  entriesCount,
  loadedImageKeys,
  onUpdate,
  onRemove,
  onPreview,
}: CreatureBinderCardProps) {
  const handleBlurHash = useCallback(
    (id: string, blurHash: string) => onUpdate(id, { blurHash }),
    [onUpdate],
  );

  return (
    <article
      className="creature-card"
      role="listitem"
      aria-posinset={entryIndex + 1}
      aria-setsize={entriesCount}
    >
      <CreatureThumbnail
        className="creature-art"
        entry={entry}
        imageLoading="eager"
        loadedImageKeys={loadedImageKeys}
        onPreview={onPreview}
        onBlurHash={handleBlurHash}
      />

      <div className="creature-card-body">
        <input
          className="binder-creature-name"
          aria-label="Creature name"
          value={entry.name}
          onChange={(event) =>
            onUpdate(entry.id, {
              name: event.target.value,
            })
          }
        />
        <div className="creature-settings">
          <label className="binder-card-select">
            <span>Size</span>
            <select
              aria-label="Size"
              value={entry.creatureSize}
              onChange={(event) =>
                onUpdate(entry.id, {
                  creatureSize: event.target.value as CreatureSize,
                })
              }
            >
              {CREATURE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size[0].toUpperCase() + size.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="binder-card-select">
            <span>Scale</span>
            <select
              aria-label="Scale"
              value={entry.miniSize}
              onChange={(event) =>
                onUpdate(entry.id, {
                  miniSize: Number(event.target.value) as MiniSize,
                })
              }
            >
              {MINI_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}mm
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="binder-card-checkbox">
          <input
            type="checkbox"
            checked={entry.showName}
            onChange={(event) =>
              onUpdate(entry.id, {
                showName: event.target.checked,
              })
            }
          />
          <span>Show name on base</span>
        </label>
        <div className="creature-card-actions">
          {!entry.sourceId && (
            <button
              className="binder-remove-button"
              type="button"
              onClick={() => onRemove(entry.id)}
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </article>
  );
});

interface BinderGridRowProps {
  entries: MiniFigEntry[];
  rowIndex: number;
  columnCount: number;
  entriesCount: number;
  loadedImageKeys: Set<string>;
  onUpdate: (id: string, patch: Partial<MiniFigEntry>) => void;
  onRemove: (id: string) => void;
  onPreview: (id: string) => void;
  onHeightChange: (rowIndex: number, height: number) => void;
  renderPlaceholders?: boolean;
}

function BinderGridRow({
  entries,
  rowIndex,
  columnCount,
  entriesCount,
  loadedImageKeys,
  onUpdate,
  onRemove,
  onPreview,
  onHeightChange,
  renderPlaceholders = false,
}: BinderGridRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (renderPlaceholders || !rowRef.current) return;

    const element = rowRef.current;
    const measure = () => {
      onHeightChange(rowIndex, Math.ceil(element.getBoundingClientRect().height));
    };
    const observer = new ResizeObserver(measure);

    measure();
    observer.observe(element);
    return () => observer.disconnect();
  }, [onHeightChange, renderPlaceholders, rowIndex]);

  return (
    <div
      className="creature-grid binder-virtual-row"
      ref={rowRef}
      style={{
        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
      }}
    >
      {entries.map((entry, columnIndex) =>
        renderPlaceholders ? (
          <article
            className="creature-card binder-card-placeholder"
            key={entry.id}
            role="listitem"
            aria-posinset={rowIndex * columnCount + columnIndex + 1}
            aria-setsize={entriesCount}
          >
            <div className="binder-placeholder-art" />
            <div className="binder-placeholder-body">
              <strong>{entry.name}</strong>
              <div className="binder-placeholder-controls" aria-hidden="true" />
              <div className="binder-placeholder-controls" aria-hidden="true" />
            </div>
          </article>
        ) : (
          <CreatureBinderCard
            entry={entry}
            entryIndex={rowIndex * columnCount + columnIndex}
            entriesCount={entriesCount}
            key={entry.id}
            loadedImageKeys={loadedImageKeys}
            onPreview={onPreview}
            onRemove={onRemove}
            onUpdate={onUpdate}
          />
        ),
      )}
    </div>
  );
}

interface BinderVirtualizedGridProps {
  entries: MiniFigEntry[];
  height: number;
  isScrolling: boolean;
  onChildScroll: (params: { scrollTop: number }) => void;
  onPreview: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<MiniFigEntry>) => void;
  scrollTop: number;
  width: number;
}

function BinderVirtualizedGrid({
  entries,
  height,
  isScrolling,
  onChildScroll,
  onPreview,
  onRemove,
  onUpdate,
  scrollTop,
  width,
}: BinderVirtualizedGridProps) {
  const listRef = useRef<List>(null);
  const loadedImageKeysRef = useRef(new Set<string>());
  const rowHeightsRef = useRef(new Map<number, number>());
  const renderedRowsRef = useRef(new Set<number>());
  const needsEstimateRef = useRef(true);
  const [estimatedRowHeight, setEstimatedRowHeight] = useState(
    INITIAL_ROW_HEIGHT_ESTIMATE,
  );
  const columnCount = Math.max(
    1,
    Math.floor((width + GRID_GAP) / (CARD_MIN_WIDTH + GRID_GAP)),
  );
  const rows = useMemo(() => {
    const nextRows: MiniFigEntry[][] = [];
    for (let index = 0; index < entries.length; index += columnCount) {
      nextRows.push(entries.slice(index, index + columnCount));
    }
    return nextRows;
  }, [columnCount, entries]);

  useLayoutEffect(() => {
    rowHeightsRef.current.clear();
    renderedRowsRef.current.clear();
    needsEstimateRef.current = true;
    listRef.current?.recomputeRowHeights();
  }, [columnCount, rows.length, width]);

  useLayoutEffect(() => {
    listRef.current?.recomputeRowHeights();
  }, [estimatedRowHeight]);

  const handleRowHeightChange = useCallback(
    (rowIndex: number, height: number) => {
      const cachedHeight = rowHeightsRef.current.get(rowIndex);
      if (cachedHeight === height) return;

      rowHeightsRef.current.set(rowIndex, height);
      if (needsEstimateRef.current) {
        needsEstimateRef.current = false;
        setEstimatedRowHeight(height);
      }
      listRef.current?.recomputeRowHeights(rowIndex);
    },
    [],
  );

  const getRowHeight = useCallback(
    ({ index }: { index: number }) =>
      rowHeightsRef.current.get(index) ?? estimatedRowHeight,
    [estimatedRowHeight],
  );

  return (
    <List
      ref={listRef}
      autoHeight
      estimatedRowSize={estimatedRowHeight}
      height={height}
      isScrolling={isScrolling}
      onScroll={onChildScroll}
      overscanRowCount={3}
      role="presentation"
      rowCount={rows.length}
      rowHeight={getRowHeight}
      rowRenderer={({ index, isScrolling: isRowScrolling, key, style }) => {
        const renderPlaceholders =
          isRowScrolling && !renderedRowsRef.current.has(index);
        if (!renderPlaceholders) {
          renderedRowsRef.current.add(index);
        }

        return (
          <div key={key} role="presentation" style={style}>
            <BinderGridRow
              entries={rows[index]}
              rowIndex={index}
              columnCount={columnCount}
              entriesCount={entries.length}
              loadedImageKeys={loadedImageKeysRef.current}
              onPreview={onPreview}
              onRemove={onRemove}
              onUpdate={onUpdate}
              onHeightChange={handleRowHeightChange}
              renderPlaceholders={renderPlaceholders}
            />
          </div>
        );
      }}
      scrollTop={scrollTop}
      width={width}
    />
  );
}

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
          <CreatureSearch
            query={query}
            onQueryChange={setQuery}
            activeFilter={activeSourceFilter}
            defaultFilter={ALL_SOURCES}
            onFilterChange={(filter) => onSourceFilterChange(filter || null)}
            searchAriaLabel="Search creatures"
            filterAriaLabel="Filter creatures by source"
            filterOptions={[
              { value: ALL_SOURCES, label: `All creatures (${entries.length})` },
              {
                value: MANUAL_SOURCE,
                label: `Manually added (${sourceCounts.get(MANUAL_SOURCE) ?? 0})`,
              },
              ...sources.map((source) => ({
                value: source.id,
                label: `${source.name} (${sourceCounts.get(source.id) ?? 0})`,
              })),
            ]}
          />
          <div className="source-button-group">
            <Button
              variant="outlined"
              size="small"
              onClick={onManageSources}
              sx={{ borderRadius: "var(--radius-sm) 0 0 var(--radius-sm)" }}
            >
              Sources
            </Button>
            <Button
              variant="outlined"
              size="small"
              type="button"
              onClick={refreshAllSources}
              disabled={sources.length === 0 || refreshing}
              aria-label="Refresh all sources"
              title={sources.length === 0 ? "Add a source first" : "Refresh all sources"}
              sx={{
                minWidth: "2.45rem",
                maxWidth: "2.45rem",
                paddingInline: 0,
                borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
                borderLeftWidth: 0,
              }}
            >
              <span className={refreshing ? "refresh-icon spinning" : "refresh-icon"} aria-hidden="true">↻</span>
            </Button>
          </div>
          <Button variant="contained" size="small" onClick={onAddCreature}>
            + Add creature
          </Button>
        </div>
      </div>

      {visibleEntries.length > 0 ? (
        <WindowScroller scrollingResetTimeInterval={80}>
          {({ height, isScrolling, onChildScroll, registerChild, scrollTop }) => (
            <div
              className="binder-virtual-list"
              ref={registerChild}
              role="list"
              aria-label="Creatures"
            >
              <AutoSizer disableHeight>
                {({ width }) => (
                  <BinderVirtualizedGrid
                   entries={visibleEntries}
                   height={height}
                   isScrolling={isScrolling}
                   onChildScroll={onChildScroll}
                   onPreview={onPreview}
                   onRemove={onRemove}
                   onUpdate={onUpdate}
                   scrollTop={scrollTop}
                   width={width}
                  />
                )}
              </AutoSizer>
            </div>
          )}
        </WindowScroller>
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
