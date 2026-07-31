import { useState, type MouseEvent } from "react";
import {
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  TextField,
} from "@mui/material";

export interface CreatureFilterOption {
  value: string;
  label: string;
}

interface Props {
  query: string;
  onQueryChange: (query: string) => void;
  searchAriaLabel: string;
  filterOptions?: CreatureFilterOption[];
  activeFilter?: string;
  defaultFilter?: string;
  onFilterChange?: (filter: string) => void;
  filterAriaLabel?: string;
}

export function CreatureSearch({
  query,
  onQueryChange,
  filterOptions,
  activeFilter,
  defaultFilter,
  onFilterChange,
  searchAriaLabel,
  filterAriaLabel,
}: Props) {
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<HTMLElement | null>(null);
  const hasFilterMenu = Boolean(
    filterOptions
      && activeFilter !== undefined
      && defaultFilter !== undefined
      && onFilterChange
      && filterAriaLabel,
  );
  const hasActiveFilter = hasFilterMenu && activeFilter !== defaultFilter;

  const selectFilter = (filter: string) => {
    onFilterChange?.(filter);
    setFilterMenuAnchor(null);
  };

  return (
    <>
      <TextField
        className="creature-search"
        type="search"
        size="small"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search creatures…"
        slotProps={{
          htmlInput: { "aria-label": searchAriaLabel },
          input: hasFilterMenu ? {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  className="creature-search-filter-button"
                  color={hasActiveFilter ? "primary" : "default"}
                  size="small"
                  aria-label={filterAriaLabel ?? "Filter creatures"}
                  aria-controls={filterMenuAnchor ? "creature-filter-menu" : undefined}
                  aria-haspopup="menu"
                  aria-expanded={filterMenuAnchor ? "true" : undefined}
                  onClick={(event: MouseEvent<HTMLElement>) =>
                    setFilterMenuAnchor(event.currentTarget)
                  }
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 7h16M7 12h10M10 17h4" />
                  </svg>
                </IconButton>
              </InputAdornment>
            ),
          } : undefined,
        }}
      />
      <Menu
        id="creature-filter-menu"
        className="creature-filter-menu"
        anchorEl={filterMenuAnchor}
        open={hasFilterMenu && Boolean(filterMenuAnchor)}
        onClose={() => setFilterMenuAnchor(null)}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
      >
        {filterOptions?.map((option) => (
          <MenuItem
            key={option.value}
            selected={option.value === activeFilter}
            onClick={() => selectFilter(option.value)}
          >
            {option.label}
          </MenuItem>
        ))}
        {hasActiveFilter && (
          <MenuItem onClick={() => selectFilter(defaultFilter ?? "")}>
            Clear filter
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
