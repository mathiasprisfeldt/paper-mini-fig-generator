import { useState, type MouseEvent } from "react";
import {
  Checkbox,
  Divider,
  IconButton,
  InputAdornment,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  TextField,
} from "@mui/material";
import type { CreatureOrder } from "../types";

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
  printedOnly?: boolean;
  onPrintedOnlyChange?: (printedOnly: boolean) => void;
  order: CreatureOrder;
  onOrderChange: (order: CreatureOrder) => void;
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
  printedOnly = false,
  onPrintedOnlyChange,
  order,
  onOrderChange,
}: Props) {
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<HTMLElement | null>(null);
  const [orderMenuAnchor, setOrderMenuAnchor] = useState<HTMLElement | null>(null);
  const hasFilterMenu = Boolean(
    filterOptions
      && activeFilter !== undefined
      && defaultFilter !== undefined
      && onFilterChange
      && filterAriaLabel,
  );
  const hasActiveFilter = hasFilterMenu && (activeFilter !== defaultFilter || printedOnly);

  const selectFilter = (filter: string) => {
    onFilterChange?.(filter);
    setFilterMenuAnchor(null);
  };

  const selectOrder = (change: Partial<CreatureOrder>) => {
    onOrderChange({ ...order, ...change });
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
          input: {
            endAdornment: (
              <InputAdornment position="end">
                {hasFilterMenu && (
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
                )}
                <IconButton
                  className="creature-search-order-button"
                  color={order.field !== "name" || order.direction !== "asc" ? "primary" : "default"}
                  size="small"
                  aria-label="Sort creatures"
                  title="Sort creatures"
                  aria-controls={orderMenuAnchor ? "creature-order-menu" : undefined}
                  aria-haspopup="menu"
                  aria-expanded={orderMenuAnchor ? "true" : undefined}
                  onClick={(event: MouseEvent<HTMLElement>) =>
                    setOrderMenuAnchor(event.currentTarget)
                  }
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 7h12M4 12h8M4 17h4" />
                    <path d={order.direction === "asc"
                      ? "M19 18V6m-4 4 4-4 4 4"
                      : "M19 6v12m-4-4 4 4 4-4"} />
                  </svg>
                </IconButton>
              </InputAdornment>
            ),
          },
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
        {onPrintedOnlyChange && (
          <MenuItem
            role="menuitemcheckbox"
            aria-checked={printedOnly}
            selected={printedOnly}
            onClick={() => {
              onPrintedOnlyChange(!printedOnly);
              setFilterMenuAnchor(null);
            }}
          >
            <Checkbox checked={printedOnly} tabIndex={-1} disableRipple sx={{ pointerEvents: "none" }} />
            Printed only
          </MenuItem>
        )}
        {onPrintedOnlyChange && <Divider />}
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
          <MenuItem onClick={() => {
            onFilterChange?.(defaultFilter ?? "");
            onPrintedOnlyChange?.(false);
            setFilterMenuAnchor(null);
          }}>
            Clear filter
          </MenuItem>
        )}
      </Menu>
      <Menu
        id="creature-order-menu"
        anchorEl={orderMenuAnchor}
        open={Boolean(orderMenuAnchor)}
        onClose={() => setOrderMenuAnchor(null)}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
      >
        <ListSubheader disableSticky>Sort by</ListSubheader>
        <MenuItem selected={order.field === "name"} onClick={() => selectOrder({ field: "name" })}>
          Name
        </MenuItem>
        <MenuItem selected={order.field === "created"} onClick={() => selectOrder({ field: "created" })}>
          Created
        </MenuItem>
        <Divider />
        <ListSubheader disableSticky>Direction</ListSubheader>
        <MenuItem selected={order.direction === "asc"} onClick={() => selectOrder({ direction: "asc" })}>
          <ListItemText primary="Ascending" secondary={order.field === "name" ? "A–Z" : "Oldest first"} />
        </MenuItem>
        <MenuItem selected={order.direction === "desc"} onClick={() => selectOrder({ direction: "desc" })}>
          <ListItemText primary="Descending" secondary={order.field === "name" ? "Z–A" : "Newest first"} />
        </MenuItem>
      </Menu>
    </>
  );
}
