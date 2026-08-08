import { useState } from "react";
import { Button } from "@mui/material";
import type { CreatureSource, SourceRefreshResult } from "../types";
import { useToast } from "../toastContext";

interface Props {
  sources: CreatureSource[];
  onManageSources: () => void;
  onRefreshSources: () => Promise<SourceRefreshResult>;
}

export function SourceToolbarActions({
  sources,
  onManageSources,
  onRefreshSources,
}: Props) {
  const { showToast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

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
    <div className="source-button-group">
      <Button
        variant="outlined"
        size="small"
        onClick={onManageSources}
        sx={{
          height: 40,
          borderRadius: "var(--radius-sm) 0 0 var(--radius-sm)",
        }}
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
          height: 40,
          minWidth: "2.45rem",
          maxWidth: "2.45rem",
          paddingInline: 0,
          borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
          borderLeftWidth: 0,
        }}
      >
        <span
          className={refreshing ? "refresh-icon spinning" : "refresh-icon"}
          aria-hidden="true"
        >
          ↻
        </span>
      </Button>
    </div>
  );
}
