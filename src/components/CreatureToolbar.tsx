import type { ReactNode } from "react";
import { Button } from "@mui/material";
import type {
  CreatureSource,
  MiniFigEntry,
  SourceRefreshResult,
} from "../types";
import { CreatureSearch } from "./CreatureSearch";
import { SourceToolbarActions } from "./SourceToolbarActions";

const ALL_SOURCES = "";
const MANUAL_SOURCE = "manual";

interface Props {
  entries: MiniFigEntry[];
  sources: CreatureSource[];
  sourceFilter: string | null;
  query: string;
  searchAriaLabel: string;
  filterAriaLabel: string;
  onQueryChange: (query: string) => void;
  onSourceFilterChange: (sourceId: string | null) => void;
  onManageSources: () => void;
  onRefreshSources: () => Promise<SourceRefreshResult>;
  onAddCreature: () => void;
  children?: ReactNode;
}

export function CreatureToolbar({
  entries,
  sources,
  sourceFilter,
  query,
  searchAriaLabel,
  filterAriaLabel,
  onQueryChange,
  onSourceFilterChange,
  onManageSources,
  onRefreshSources,
  onAddCreature,
  children,
}: Props) {
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
    <div className="creature-toolbar-actions">
      <CreatureSearch
        query={query}
        onQueryChange={onQueryChange}
        activeFilter={activeSourceFilter}
        defaultFilter={ALL_SOURCES}
        onFilterChange={(filter) => onSourceFilterChange(filter || null)}
        searchAriaLabel={searchAriaLabel}
        filterAriaLabel={filterAriaLabel}
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
      <SourceToolbarActions
        sources={sources}
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
