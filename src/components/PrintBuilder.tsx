import {
  useMemo,
  useRef,
  useState,
} from "react";
import { AutoSizer, List, WindowScroller } from "react-virtualized";
import {
  Alert,
  Autocomplete,
  Button,
  ButtonGroup,
  CircularProgress,
  createFilterOptions,
  Divider,
  IconButton,
  InputBase,
  Menu,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  useMediaQuery,
} from "@mui/material";
import type {
  PaperFormat,
  PrintableMiniFigEntry,
  PrintCatalogue,
  PrintLayout,
  MiniSize,
  CreatureSource,
  SourceRefreshResult,
} from "../types";
import { AppModal } from "./AppModal";
import { CreatureToolbar } from "./CreatureToolbar";
import { CreatureThumbnail } from "./CreatureThumbnail";

interface CreateCatalogueOption {
  inputValue: string;
  name: string;
}

type CatalogueOption = PrintCatalogue | CreateCatalogueOption;
type PrintEntryFilter = "all" | "selected";

const filterCatalogueOptions = createFilterOptions<CatalogueOption>({
  stringify: (option) => option.name,
});
const PRINT_ROW_HEIGHT = 90;
const MOBILE_PRINT_ROW_HEIGHT = 120;
const ALL_SOURCES = "";
const MANUAL_SOURCE = "manual";
interface Props {
  entries: PrintableMiniFigEntry[];
  sources: CreatureSource[];
  sourceFilter: string | null;
  printCatalogues: PrintCatalogue[];
  activePrintCatalogueId: string | null;
  paperFormat: PaperFormat;
  printLayout: PrintLayout;
  miniSize: MiniSize;
  generating: boolean;
  exportError: string;
  onQuantityChange: (id: string, quantity: number) => void;
  onSourceFilterChange: (sourceId: string | null) => void;
  onBlurHash: (id: string, blurHash: string) => void;
  onPreview: (id: string) => void;
  onAddCreature: () => void;
  onManageSources: () => void;
  onRefreshSources: () => Promise<SourceRefreshResult>;
  onQuickAdd: () => void;
  onClearSelection: () => void;
  onPaperFormatChange: (format: PaperFormat) => void;
  onPrintLayoutChange: (layout: PrintLayout) => void;
  onMiniSizeChange: (size: MiniSize) => void;
  onPrint: () => void;
  onGenerate: () => void;
  onCreatePrintCatalogue: (name: string) => void;
  onSelectPrintCatalogue: (id: string | null) => void;
  onRenamePrintCatalogue: (name: string) => void;
  onDeletePrintCatalogue: () => void;
}

export function PrintBuilder({
  entries,
  sources,
  sourceFilter,
  printCatalogues,
  activePrintCatalogueId,
  paperFormat,
  printLayout,
  miniSize,
  generating,
  exportError,
  onQuantityChange,
  onSourceFilterChange,
  onBlurHash,
  onPreview,
  onAddCreature,
  onManageSources,
  onRefreshSources,
  onQuickAdd,
  onClearSelection,
  onPaperFormatChange,
  onPrintLayoutChange,
  onMiniSizeChange,
  onPrint,
  onGenerate,
  onCreatePrintCatalogue,
  onSelectPrintCatalogue,
  onRenamePrintCatalogue,
  onDeletePrintCatalogue,
}: Props) {
  const isMobile = useMediaQuery("(max-width: 640px)");
  const printRowHeight = isMobile
    ? MOBILE_PRINT_ROW_HEIGHT
    : PRINT_ROW_HEIGHT;
  const [query, setQuery] = useState("");
  const [entryFilter, setEntryFilter] = useState<PrintEntryFilter>("all");
  const [catalogueMenuAnchor, setCatalogueMenuAnchor] =
    useState<HTMLElement | null>(null);
  const [renamingCatalogue, setRenamingCatalogue] = useState(false);
  const [catalogueNameDraft, setCatalogueNameDraft] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const activeSourceFilter =
    !sourceFilter ||
    sourceFilter === MANUAL_SOURCE ||
    sources.some((source) => source.id === sourceFilter)
      ? sourceFilter ?? ALL_SOURCES
      : ALL_SOURCES;
  const total = entries.reduce((sum, entry) => sum + entry.quantity, 0);
  const selectedKinds = entries.filter((entry) => entry.quantity > 0).length;
  const activePrintCatalogue =
    printCatalogues.find(
      (catalogue) => catalogue.id === activePrintCatalogueId,
    ) ?? null;
  const chooseOrCreateCatalogue = (value: CatalogueOption | string | null) => {
    setRenamingCatalogue(false);
    setCatalogueMenuAnchor(null);
    if (!value) {
      onSelectPrintCatalogue(null);
      return;
    }

    const name = typeof value === "string"
      ? value.trim()
      : "inputValue" in value
        ? value.inputValue.trim()
        : "";
    if (!name && typeof value !== "string" && !("inputValue" in value)) {
      onSelectPrintCatalogue(value.id);
      return;
    }
    if (!name) return;
    const existing = printCatalogues.find(
      (catalogue) => catalogue.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
    if (existing) {
      onSelectPrintCatalogue(existing.id);
      return;
    }
    onCreatePrintCatalogue(name);
  };
  const visibleEntries = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return [...entries]
      .filter((entry) => {
        const matchesQuery =
          !normalized || entry.name.toLowerCase().includes(normalized);
        const matchesSelection =
          entryFilter === "all" || entry.quantity > 0;
        const matchesSource =
          activeSourceFilter === ALL_SOURCES ||
          (activeSourceFilter === MANUAL_SOURCE
            ? !entry.sourceId
            : entry.sourceId === activeSourceFilter);
        return matchesQuery && matchesSelection && matchesSource;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activeSourceFilter, entries, entryFilter, query]);
  return (
    <div className="print-layout">
      <section className="print-picker">
        <div className="section-toolbar">
          <CreatureToolbar
              entries={entries}
              sources={sources}
              sourceFilter={sourceFilter}
              query={query}
              onQueryChange={setQuery}
              searchAriaLabel="Search print creatures"
              filterAriaLabel="Filter print creatures by source"
              onSourceFilterChange={onSourceFilterChange}
              onManageSources={onManageSources}
              onRefreshSources={onRefreshSources}
              onAddCreature={onAddCreature}
          >
              <Divider
                className="print-toolbar-divider"
              flexItem
              orientation="vertical"
            />
            <ToggleButton
              className="print-selected-toggle"
              value="selected"
              selected={entryFilter === "selected"}
              onClick={() =>
                setEntryFilter((current) =>
                  current === "selected" ? "all" : "selected"
                )
              }
              color="primary"
              size="small"
              aria-label="Show selected creatures only"
              sx={{ height: 40 }}
            >
              Selected creatures ({selectedKinds})
            </ToggleButton>
            <Button
              variant="outlined"
              size="small"
              type="button"
              onClick={onQuickAdd}
              disabled={entries.length === 0}
              sx={{ height: 40 }}
            >
              Quick select
            </Button>
          </CreatureToolbar>
        </div>

        {visibleEntries.length > 0 ? (
          <WindowScroller>
            {({ height, isScrolling, onChildScroll, scrollTop }) => (
              <AutoSizer disableHeight>
                {({ width }) => (
                  <List
                      autoHeight
                      className="print-creature-list"
                      height={height}
                      isScrolling={isScrolling}
                      onScroll={onChildScroll}
                      overscanRowCount={8}
                      rowCount={visibleEntries.length}
                      rowHeight={printRowHeight}
                      rowRenderer={({ index, key, style }) => {
                        const entry = visibleEntries[index];
                        return (
                          <div key={key} style={style}>
                            <article
                              className={`print-creature-row${entry.quantity ? " selected" : ""}`}
                            >
                              <CreatureThumbnail
                                className="print-creature-thumbnail"
                                entry={entry}
                                imageLoading="eager"
                                onPreview={onPreview}
                                onBlurHash={onBlurHash}
                              />
                              <div className="print-creature-info">
                                <strong>{entry.name || "Unnamed creature"}</strong>
                                <span>{entry.creatureSize}</span>
                              </div>
                              <ButtonGroup
                                className="quantity-stepper"
                                variant="outlined"
                                size="small"
                                aria-label={`${entry.name || "Creature"} quantity`}
                              >
                                <Button
                                  size="small"
                                  type="button"
                                  aria-label={`Decrease ${entry.name || "unnamed creature"} quantity`}
                                  onClick={() => onQuantityChange(entry.id, entry.quantity - 1)}
                                  disabled={entry.quantity === 0}
                                >
                                  −
                                </Button>
                                <InputBase
                                  className="quantity-input"
                                  type="number"
                                  inputProps={{
                                    "aria-label": `${entry.name || "Unnamed creature"} quantity`,
                                    min: 0,
                                    max: 99,
                                  }}
                                  value={entry.quantity}
                                  onChange={(event) => {
                                    if (event.target.value !== "") {
                                      onQuantityChange(entry.id, Number(event.target.value));
                                    }
                                  }}
                                />
                                <Button
                                  size="small"
                                  type="button"
                                  aria-label={`Increase ${entry.name || "unnamed creature"} quantity`}
                                  onClick={() => onQuantityChange(entry.id, entry.quantity + 1)}
                                  disabled={entry.quantity >= 99}
                                >
                                  +
                                </Button>
                              </ButtonGroup>
                            </article>
                          </div>
                        );
                      }}
                      scrollTop={scrollTop}
                      width={width}
                    />
                )}
              </AutoSizer>
            )}
          </WindowScroller>
        ) : entries.length === 0 ? (
          <div className="empty-state compact">
            <h3>Add creatures to your binder first</h3>
          </div>
        ) : (
          <div className="empty-state compact">
            <h3>
              {entryFilter === "selected"
                ? "No selected creatures"
                : "No matching creatures"}
            </h3>
            <p>
              {entryFilter === "selected"
                ? "Select creatures by increasing their quantity."
                : "Try another search."}
            </p>
          </div>
        )}
      </section>

      <div className="print-sidebar-spacer" aria-hidden="true" />
      <aside className="print-sidebar">
        <section className="print-catalogue-panel" aria-label="Print catalogues">
          <div className="print-catalogue-heading">
            <span className="eyebrow">Catalogues</span>
          </div>
          <div className="print-catalogue-picker">
            <Autocomplete<CatalogueOption, false, false, true>
              key={`${activePrintCatalogue?.id ?? "none"}:${activePrintCatalogue?.name ?? ""}`}
              className="print-catalogue-select"
              freeSolo
              forcePopupIcon
              options={printCatalogues}
              value={activePrintCatalogue}
              slotProps={{
                popupIndicator: {
                  disabled: printCatalogues.length === 0,
                },
              }}
              selectOnFocus
              clearOnBlur
              handleHomeEndKeys
              resetHighlightOnMouseLeave
              filterOptions={(options, params) => {
                const filtered = filterCatalogueOptions(options, params);
                const name = params.inputValue.trim();
                const hasExactMatch = printCatalogues.some(
                  (catalogue) =>
                    catalogue.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
                );
                if (name && !hasExactMatch) {
                  filtered.push({
                    inputValue: name,
                    name: `Create "${name}"`,
                  });
                }
                return filtered;
              }}
              getOptionKey={(option) =>
                typeof option === "string"
                  ? option
                  : "inputValue" in option
                    ? `create:${option.inputValue}`
                    : option.id
              }
              getOptionLabel={(option) =>
                typeof option === "string"
                  ? option
                  : "inputValue" in option
                    ? option.inputValue
                    : option.name || "Untitled catalogue"
              }
              isOptionEqualToValue={(option, value) =>
                typeof option !== "string"
                && typeof value !== "string"
                && !("inputValue" in option)
                && !("inputValue" in value)
                && option.id === value.id
              }
              onChange={(_, value) => chooseOrCreateCatalogue(value)}
              renderOption={({ key, ...props }, option) => (
                <li key={key} {...props}>
                  {"inputValue" in option ? (
                    <span className="print-catalogue-create-option">
                      <svg viewBox="0 0 20 20" aria-hidden="true">
                        <circle cx="10" cy="10" r="8" />
                        <path d="M10 6v8M6 10h8" />
                      </svg>
                      <span>{option.name}</span>
                    </span>
                  ) : (
                    option.name || "Untitled catalogue"
                  )}
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Name"
                  slotProps={{
                    ...params.slotProps,
                    htmlInput: {
                      ...params.slotProps.htmlInput,
                      "aria-label": "Catalogue",
                    },
                  }}
                  size="small"
                />
              )}
            />
            <IconButton
              className="print-catalogue-menu-button"
              aria-label="Catalogue actions"
              aria-controls={catalogueMenuAnchor ? "catalogue-actions-menu" : undefined}
              aria-haspopup="menu"
              aria-expanded={catalogueMenuAnchor ? "true" : undefined}
              onClick={(event) => setCatalogueMenuAnchor(event.currentTarget)}
              disabled={!activePrintCatalogue}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="5" cy="12" r="1.7" />
                <circle cx="12" cy="12" r="1.7" />
                <circle cx="19" cy="12" r="1.7" />
              </svg>
            </IconButton>
            <Menu
              id="catalogue-actions-menu"
              className="print-catalogue-menu"
              anchorEl={catalogueMenuAnchor}
              open={Boolean(catalogueMenuAnchor)}
              onClose={() => setCatalogueMenuAnchor(null)}
              anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
              transformOrigin={{ horizontal: "right", vertical: "top" }}
            >
              <MenuItem
                onClick={() => {
                  setCatalogueNameDraft(activePrintCatalogue?.name ?? "");
                  setRenamingCatalogue(true);
                  setCatalogueMenuAnchor(null);
                }}
              >
                Rename
              </MenuItem>
              <MenuItem
                className="print-catalogue-delete-item"
                onClick={() => {
                  setCatalogueMenuAnchor(null);
                  onDeletePrintCatalogue();
                }}
              >
                Delete
              </MenuItem>
            </Menu>
          </div>
          {activePrintCatalogue && renamingCatalogue && (
            <AppModal
              className="rename-catalogue-dialog"
              ariaLabelledBy="rename-catalogue-title"
              onEntered={() => {
                renameInputRef.current?.focus();
                renameInputRef.current?.select();
              }}
              onClose={() => setRenamingCatalogue(false)}
            >
              <form
                className="rename-catalogue-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const name = catalogueNameDraft.trim();
                  if (!name) return;
                  onRenamePrintCatalogue(name);
                  setRenamingCatalogue(false);
                }}
              >
                <div className="dialog-heading">
                  <div>
                    <span className="eyebrow">Catalogue</span>
                    <h2 id="rename-catalogue-title">Rename catalogue</h2>
                  </div>
                </div>
                <TextField
                    className="print-catalogue-name"
                    label="Name"
                    size="small"
                    inputRef={renameInputRef}
                    value={catalogueNameDraft}
                    onChange={(event) => setCatalogueNameDraft(event.target.value)}
                    slotProps={{ htmlInput: { "aria-label": "Catalogue name" } }}
                  />
                <div className="print-catalogue-actions">
                  <Button
                    variant="outlined"
                    type="button"
                    onClick={() => setRenamingCatalogue(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    type="submit"
                    disabled={!catalogueNameDraft.trim()}
                  >
                    Save
                  </Button>
                </div>
              </form>
            </AppModal>
          )}
        </section>
        <section className="print-summary">
        <div className="print-summary-heading">
          <span className="eyebrow">Export</span>
          <IconButton
            className="clear-selection-button"
            size="small"
            aria-label="Clear selection"
            title="Clear selection"
            onClick={onClearSelection}
            disabled={total === 0}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 11a8 8 0 1 1-2.34-5.66L20 8" />
              <path d="M20 4v4h-4" />
            </svg>
          </IconButton>
        </div>
        <div className="summary-stat">
          <strong>{total}</strong>
          <span>miniature{total === 1 ? "" : "s"}</span>
        </div>
        <p>{selectedKinds} unique creature{selectedKinds === 1 ? "" : "s"}</p>

        <div className="paper-format-control">
          <span>Paper size</span>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            color="primary"
            value={paperFormat}
            onChange={(_, format: PaperFormat | null) => {
              if (format) onPaperFormatChange(format);
            }}
            aria-label="Paper size"
          >
            {(["a4", "a3"] as PaperFormat[]).map((format) => (
              <ToggleButton key={format} value={format}>
                {format.toUpperCase()}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>

        <div className="paper-format-control">
          <span>Print scale</span>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            color="primary"
            value={miniSize}
            onChange={(_, size: MiniSize | null) => {
              if (size) onMiniSizeChange(size);
            }}
            aria-label="Print scale"
          >
            {([24, 28, 32] as MiniSize[]).map((size) => (
              <ToggleButton key={size} value={size}>{size}mm</ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>

        <div className="paper-format-control">
          <span>Page layout</span>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            color="primary"
            value={printLayout}
            onChange={(_, layout: PrintLayout | null) => {
              if (layout) onPrintLayoutChange(layout);
            }}
            aria-label="PDF page layout"
          >
            <ToggleButton value="compact">
              Compact
            </ToggleButton>
            <ToggleButton value="per-creature">
              Per creature
            </ToggleButton>
          </ToggleButtonGroup>
          <small className="layout-hint">
            Per creature starts each creature type on a separate page for easier cutting.
          </small>
        </div>

        {exportError && <Alert severity="error">{exportError}</Alert>}
        <div className="export-actions" role="group" aria-label="Export actions">
          <IconButton
            className="export-action-button"
            aria-label="Print sheet"
            title="Print sheet"
            onClick={onPrint}
            disabled={generating || total === 0}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 9V3h12v6" />
              <path d="M6 17H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
              <path d="M6 14h12v7H6z" />
            </svg>
          </IconButton>
          <IconButton
            className="export-action-button"
            aria-label={generating ? "Generating PDF" : "Download PDF"}
            title={generating ? "Generating PDF" : "Download PDF"}
            onClick={onGenerate}
            disabled={generating || total === 0}
          >
            {generating ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 3v12" />
                <path d="m7 10 5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
            )}
          </IconButton>
        </div>
        </section>
      </aside>
    </div>
  );
}
