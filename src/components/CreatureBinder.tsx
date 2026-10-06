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
  CreatureOrder,
  CreatureSource,
  MiniFigEntry,
  SourceRefreshResult,
} from "../types";
import { sortCreatureEntries } from "../creatureOrder";
import { CreatureToolbar } from "./CreatureToolbar";
import { CreatureThumbnail } from "./CreatureThumbnail";
import {
  IconButton,
  Menu,
  MenuItem,
} from "@mui/material";

type BinderEntry = MiniFigEntry & { quantity?: number };

interface Props {
  entries: BinderEntry[];
  printedOnly: boolean;
  onPrintedOnlyChange: (printedOnly: boolean) => void;
  forcePlaceholders: boolean;
  imageRetryKey: string;
  sources: CreatureSource[];
  sourceFilter: string | null;
  order: CreatureOrder;
  onOrderChange: (order: CreatureOrder) => void;
  onRemove: (id: string) => void;
  onPreview: (id: string) => void;
  onAddCreature: () => void;
  onManageSources: () => void;
  onRefreshSources: () => Promise<SourceRefreshResult>;
  onSourceFilterChange: (sourceId: string | null) => void;
}

const ALL_SOURCES = "";
const MANUAL_SOURCE = "manual";
const CARD_MIN_WIDTH = 230;
const GRID_GAP = 8;
const INITIAL_ROW_HEIGHT_ESTIMATE = 290;

interface CreatureBinderCardProps {
  entry: BinderEntry;
  entryIndex: number;
  entriesCount: number;
  forcePlaceholders: boolean;
  imageRetryKey: string;
  loadedImageKeys: Set<string>;
  onRemove?: (id: string) => void;
  onPreview: (id: string) => void;
}

const CreatureBinderCard = memo(function CreatureBinderCard({
  entry,
  entryIndex,
  entriesCount,
  forcePlaceholders,
  imageRetryKey,
  loadedImageKeys,
  onRemove,
  onPreview,
}: CreatureBinderCardProps) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  return (
    <article
      className="creature-card"
      role="listitem"
      aria-posinset={entryIndex + 1}
      aria-setsize={entriesCount}
    >
      {onRemove && !entry.sourceId && (
        <IconButton
          className="binder-card-menu-button"
          aria-label={`Actions for ${entry.name || "unnamed creature"}`}
          aria-controls={menuAnchor ? `creature-actions-${entry.id}` : undefined}
          aria-haspopup="menu"
          aria-expanded={menuAnchor ? "true" : undefined}
          onClick={(event) => {
            event.stopPropagation();
            setMenuAnchor(event.currentTarget);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="5" r="1.7" />
            <circle cx="12" cy="12" r="1.7" />
            <circle cx="12" cy="19" r="1.7" />
          </svg>
        </IconButton>
      )}
      <CreatureThumbnail
        className="creature-art"
        entry={entry}
        forcePlaceholder={forcePlaceholders}
        imageLoading="eager"
        key={`${entry.id}:${imageRetryKey}`}
        loadedImageKeys={loadedImageKeys}
        onPreview={onPreview}
      />

      <div className="creature-card-body">
        <strong className="binder-creature-title">
          {entry.name || "Unnamed creature"}
        </strong>
        {entry.quantity !== undefined && (
          <span className="printed-quantity">{entry.quantity} printed</span>
        )}
      </div>
      <Menu
        id={`creature-actions-${entry.id}`}
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
      >
        <MenuItem
          className="binder-remove-menu-item"
          onClick={() => {
            setMenuAnchor(null);
            onRemove?.(entry.id);
          }}
        >
          Remove
        </MenuItem>
      </Menu>
    </article>
  );
});

interface BinderGridRowProps {
  entries: BinderEntry[];
  rowIndex: number;
  columnCount: number;
  entriesCount: number;
  forcePlaceholders: boolean;
  imageRetryKey: string;
  loadedImageKeys: Set<string>;
  onRemove?: (id: string) => void;
  onPreview: (id: string) => void;
  onHeightChange: (rowIndex: number, height: number) => void;
}

function BinderGridRow({
  entries,
  rowIndex,
  columnCount,
  entriesCount,
  forcePlaceholders,
  imageRetryKey,
  loadedImageKeys,
  onRemove,
  onPreview,
  onHeightChange,
}: BinderGridRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!rowRef.current) return;

    const element = rowRef.current;
    const measure = () => {
      onHeightChange(rowIndex, Math.ceil(element.getBoundingClientRect().height));
    };
    const observer = new ResizeObserver(measure);

    measure();
    observer.observe(element);
    return () => observer.disconnect();
  }, [onHeightChange, rowIndex]);

  return (
    <div
      className="creature-grid binder-virtual-row"
      ref={rowRef}
      style={{
        gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
      }}
    >
      {entries.map((entry, columnIndex) => (
        <CreatureBinderCard
          entry={entry}
          entryIndex={rowIndex * columnCount + columnIndex}
          entriesCount={entriesCount}
          forcePlaceholders={forcePlaceholders}
          imageRetryKey={imageRetryKey}
          key={entry.id}
          loadedImageKeys={loadedImageKeys}
          onPreview={onPreview}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

interface BinderVirtualizedGridProps {
  entries: BinderEntry[];
  forcePlaceholders: boolean;
  imageRetryKey: string;
  height: number;
  isScrolling: boolean;
  onChildScroll: (params: { scrollTop: number }) => void;
  onPreview: (id: string) => void;
  onRemove?: (id: string) => void;
  scrollTop: number;
  width: number;
}

export function BinderVirtualizedGrid({
  entries,
  forcePlaceholders,
  imageRetryKey,
  height,
  isScrolling,
  onChildScroll,
  onPreview,
  onRemove,
  scrollTop,
  width,
}: BinderVirtualizedGridProps) {
  const listRef = useRef<List>(null);
  const loadedImageKeysRef = useRef(new Set<string>());
  const rowHeightsRef = useRef(new Map<number, number>());
  const needsEstimateRef = useRef(true);
  const [estimatedRowHeight, setEstimatedRowHeight] = useState(
    INITIAL_ROW_HEIGHT_ESTIMATE,
  );
  const columnCount = Math.max(
    1,
    Math.floor((width + GRID_GAP) / (CARD_MIN_WIDTH + GRID_GAP)),
  );
  const rows = useMemo(() => {
    const nextRows: BinderEntry[][] = [];
    for (let index = 0; index < entries.length; index += columnCount) {
      nextRows.push(entries.slice(index, index + columnCount));
    }
    return nextRows;
  }, [columnCount, entries]);
  const rowLayoutKey = useMemo(
    () => rows.map((row) => row.map((entry) => entry.id).join(",")).join(";"),
    [rows],
  );

  useLayoutEffect(() => {
    rowHeightsRef.current.clear();
    needsEstimateRef.current = true;
    listRef.current?.recomputeRowHeights();
  }, [columnCount, rowLayoutKey, width]);

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
      rowRenderer={({ index, key, style }) => (
        <div key={key} role="presentation" style={style}>
          <BinderGridRow
            entries={rows[index]}
            rowIndex={index}
            columnCount={columnCount}
            entriesCount={entries.length}
            forcePlaceholders={forcePlaceholders}
            imageRetryKey={imageRetryKey}
            loadedImageKeys={loadedImageKeysRef.current}
            onPreview={onPreview}
            onRemove={onRemove}
            onHeightChange={handleRowHeightChange}
          />
        </div>
      )}
      scrollTop={scrollTop}
      width={width}
    />
  );
}

export function CreatureBinder({
  entries,
  printedOnly,
  onPrintedOnlyChange,
  forcePlaceholders,
  imageRetryKey,
  sources,
  sourceFilter,
  order,
  onOrderChange,
  onRemove,
  onPreview,
  onAddCreature,
  onManageSources,
  onRefreshSources,
  onSourceFilterChange,
}: Props) {
  const [query, setQuery] = useState("");
  const activeSourceFilter =
    !sourceFilter ||
    sourceFilter === MANUAL_SOURCE ||
    sources.some((source) => source.id === sourceFilter)
      ? sourceFilter ?? ALL_SOURCES
      : ALL_SOURCES;

  const visibleEntries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return sortCreatureEntries(
      entries.filter((entry) => {
        const matchesQuery =
          !normalized || entry.name.toLowerCase().includes(normalized);
        const matchesSource =
          activeSourceFilter === ALL_SOURCES ||
          (activeSourceFilter === MANUAL_SOURCE
            ? !entry.sourceId
            : entry.sourceId === activeSourceFilter);
        return matchesQuery && matchesSource && (!printedOnly || (entry.quantity ?? 0) > 0);
      }),
      sources,
      order,
    );
  }, [activeSourceFilter, entries, order, printedOnly, query, sources]);
  const totalPrinted = entries.reduce((sum, entry) => sum + (entry.quantity ?? 0), 0);
  const printedKinds = entries.filter((entry) => (entry.quantity ?? 0) > 0).length;

  return (
    <>
    <section className="binder-section">
      <div className="section-toolbar">
        <CreatureToolbar
          entries={entries}
          sources={sources}
          sourceFilter={sourceFilter}
          order={order}
          onOrderChange={onOrderChange}
          query={query}
          onQueryChange={setQuery}
          searchAriaLabel="Search creatures"
          filterAriaLabel="Filter creatures"
          printedOnly={printedOnly}
          onPrintedOnlyChange={onPrintedOnlyChange}
          onSourceFilterChange={onSourceFilterChange}
          onManageSources={onManageSources}
          onRefreshSources={onRefreshSources}
          onAddCreature={onAddCreature}
        >
          <p className="collection-printed-stats">
            {totalPrinted} printed miniature{totalPrinted === 1 ? "" : "s"} · {printedKinds} creature{printedKinds === 1 ? "" : "s"}
          </p>
        </CreatureToolbar>
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
                     forcePlaceholders={forcePlaceholders}
                     imageRetryKey={imageRetryKey}
                     height={height}
                     isScrolling={isScrolling}
                     onChildScroll={onChildScroll}
                     onPreview={onPreview}
                     onRemove={onRemove}
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
          <h3>{entries.length ? "No matching creatures" : "Your collection is empty"}</h3>
          <p>{entries.length ? "Try another search or source filter." : "Add a creature manually or connect an HTML source."}</p>
        </div>
      )}
    </section>
    </>
  );
}
