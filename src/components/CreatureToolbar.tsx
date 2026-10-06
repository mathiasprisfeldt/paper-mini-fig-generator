import type { ReactNode } from "react";
import { Button } from "@mui/material";
import type {
  CreatureOrder,
  CreatureSource,
  MiniFigEntry,
  SourceRefreshResult,
} from "../types";
import { CreatureSearch } from "./CreatureSearch";
import { SourceToolbarActions } from "./SourceToolbarActions";

const ALL_SOURCES = "";
const MANUAL_SOURCE = "manual";
const PRINTED_FILTER = "printed-only";

interface Props {
  entries: MiniFigEntry[];
  sources: CreatureSource[];
  sourceFilter: string | null;
  order: CreatureOrder;
  onOrderChange: (order: CreatureOrder) => void;
  query: string;
  searchAriaLabel: string;
  filterAriaLabel: string;
  onQueryChange: (query: string) => void;
  onSourceFilterChange: (sourceId: string | null) => void;
  onManageSources: () => void;
  onRefreshSources: () => Promise<SourceRefreshResult>;
  onAddCreature: () => void;
  children?: ReactNode;
  printedOnly?: boolean;
  onPrintedOnlyChange?: (printedOnly: boolean) => void;
}

type SearchProps = Pick<Props,
  | "entries"
  | "sources"
  | "sourceFilter"
  | "order"
  | "onOrderChange"
  | "query"
  | "searchAriaLabel"
  | "filterAriaLabel"
  | "onQueryChange"
  | "onSourceFilterChange"
  | "printedOnly"
  | "onPrintedOnlyChange"
>;

export function CreatureSearchControls({
  entries,
  sources,
  sourceFilter,
  order,
  onOrderChange,
  query,
  searchAriaLabel,
  filterAriaLabel,
  onQueryChange,
  onSourceFilterChange,
  printedOnly,
  onPrintedOnlyChange,
}: SearchProps) {
  const sourceCounts = new Map<string, number>();
  for (const entry of entries) {
    const key = entry.sourceId ?? MANUAL_SOURCE;
    sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + 1);
  }
  const activeSourceFilter =
    !sourceFilter ||
    sourceFilter === MANUAL_SOURCE ||
    sources.some((source) => source.id === sourceFilter)
      ? sourceFilter ?? ALL_SOURCES
      : ALL_SOURCES;

  return (
      <CreatureSearch
        query={query}
        onQueryChange={onQueryChange}
        order={order}
        onOrderChange={onOrderChange}
        activeFilter={printedOnly ? PRINTED_FILTER : activeSourceFilter}
        defaultFilter={ALL_SOURCES}
        onFilterChange={(filter) => {
          onSourceFilterChange(filter === PRINTED_FILTER ? null : filter || null);
          onPrintedOnlyChange?.(filter === PRINTED_FILTER);
        }}
        searchAriaLabel={searchAriaLabel}
        filterAriaLabel={filterAriaLabel}
        filterOptions={[
          { value: ALL_SOURCES, label: `All creatures (${entries.length})` },
          ...(onPrintedOnlyChange ? [{
            value: PRINTED_FILTER,
            label: `Printed only (${entries.filter((entry) => "quantity" in entry && typeof entry.quantity === "number" && entry.quantity > 0).length})`,
          }] : []),
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
  );
}

export function CreatureToolbar({
  onManageSources,
  onRefreshSources,
  onAddCreature,
  children,
  ...searchProps
}: Props) {
  return (
    <div className="creature-toolbar-actions">
      <CreatureSearchControls {...searchProps} />
      <SourceToolbarActions
        sources={searchProps.sources}
        onManageSources={onManageSources}
        onRefreshSources={onRefreshSources}
      />
      <Button
        variant="contained"
        size="small"
        sx={{ height: 40 }}
        onClick={onAddCreature}
      >
        Add creature
      </Button>
      {children}
    </div>
  );
}
