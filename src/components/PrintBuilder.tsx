import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  Alert,
  Autocomplete,
  Button,
  ButtonGroup,
  CircularProgress,
  createFilterOptions,
  IconButton,
  InputBase,
  Menu,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import type {
  PaperFormat,
  PrintableMiniFigEntry,
  PrintCatalogue,
  PrintLayout,
} from "../types";
import { AppModal } from "./AppModal";
import { CreatureThumbnail } from "./CreatureThumbnail";

interface CreateCatalogueOption {
  inputValue: string;
  name: string;
}

type CatalogueOption = PrintCatalogue | CreateCatalogueOption;

const filterCatalogueOptions = createFilterOptions<CatalogueOption>({
  stringify: (option) => option.name,
});
const ESTIMATED_PRINT_ROW_HEIGHT = 84;
const PRINT_ROW_GAP = 9;

interface Props {
  entries: PrintableMiniFigEntry[];
  printCatalogues: PrintCatalogue[];
  activePrintCatalogueId: string | null;
  paperFormat: PaperFormat;
  printLayout: PrintLayout;
  generating: boolean;
  exportError: string;
  onQuantityChange: (id: string, quantity: number) => void;
  onBlurHash: (id: string, blurHash: string) => void;
  onPreview: (id: string) => void;
  onQuickAdd: () => void;
  onClearSelection: () => void;
  onPaperFormatChange: (format: PaperFormat) => void;
  onPrintLayoutChange: (layout: PrintLayout) => void;
  onGenerate: () => void;
  onCreatePrintCatalogue: (name: string) => void;
  onSelectPrintCatalogue: (id: string | null) => void;
  onRenamePrintCatalogue: (name: string) => void;
  onDeletePrintCatalogue: () => void;
}

export function PrintBuilder({
  entries,
  printCatalogues,
  activePrintCatalogueId,
  paperFormat,
  printLayout,
  generating,
  exportError,
  onQuantityChange,
  onBlurHash,
  onPreview,
  onQuickAdd,
  onClearSelection,
  onPaperFormatChange,
  onPrintLayoutChange,
  onGenerate,
  onCreatePrintCatalogue,
  onSelectPrintCatalogue,
  onRenamePrintCatalogue,
  onDeletePrintCatalogue,
}: Props) {
  const [query, setQuery] = useState("");
  const [catalogueMenuAnchor, setCatalogueMenuAnchor] =
    useState<HTMLElement | null>(null);
  const [renamingCatalogue, setRenamingCatalogue] = useState(false);
  const [catalogueNameDraft, setCatalogueNameDraft] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const printListRef = useRef<HTMLDivElement>(null);
  const [printListScrollMargin, setPrintListScrollMargin] = useState(0);
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
      .filter((entry) => !normalized || entry.name.toLowerCase().includes(normalized))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [entries, query]);
  const printListVirtualizer = useWindowVirtualizer({
    count: visibleEntries.length,
    estimateSize: () => ESTIMATED_PRINT_ROW_HEIGHT,
    gap: PRINT_ROW_GAP,
    overscan: 10,
    scrollMargin: printListScrollMargin,
  });
  const updatePrintListScrollMargin = useCallback(() => {
    const list = printListRef.current;
    if (!list) return;
    const nextMargin = list.getBoundingClientRect().top + window.scrollY;
    setPrintListScrollMargin((current) =>
      current === nextMargin ? current : nextMargin
    );
  }, []);

  useLayoutEffect(() => {
    updatePrintListScrollMargin();
  });

  useLayoutEffect(() => {
    const list = printListRef.current;
    if (!list) return;
    const resizeObserver = new ResizeObserver(updatePrintListScrollMargin);
    resizeObserver.observe(list);
    window.addEventListener("resize", updatePrintListScrollMargin);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updatePrintListScrollMargin);
    };
  }, [updatePrintListScrollMargin]);

  useLayoutEffect(() => {
    printListVirtualizer.measure();
  }, [printListVirtualizer, visibleEntries.length]);

  return (
    <div className="print-layout">
      <section className="print-picker">
        <div className="section-toolbar">
          <div className="print-toolbar-actions">
            <TextField
              className="search-input print-search-input"
              type="search"
              size="small"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search creatures…"
              slotProps={{ htmlInput: { "aria-label": "Search print creatures" } }}
            />
            <Button
              variant="outlined"
              type="button"
              onClick={onQuickAdd}
              disabled={entries.length === 0}
            >
              Quick add
            </Button>
            <Button
              variant="outlined"
              type="button"
              onClick={onClearSelection}
              disabled={total === 0}
            >
              Clear selection
            </Button>
          </div>
        </div>

        {visibleEntries.length > 0 ? (
          <div
            ref={printListRef}
            className="print-creature-list print-creature-list-virtual"
            style={{ height: printListVirtualizer.getTotalSize() }}
          >
            {printListVirtualizer.getVirtualItems().map((virtualRow) => {
              const entry = visibleEntries[virtualRow.index];
              return (
                <article
                  ref={printListVirtualizer.measureElement}
                  className={`print-creature-row${entry.quantity ? " selected" : ""}`}
                  data-index={virtualRow.index}
                  key={entry.id}
                  style={{
                    transform: `translateY(${
                      virtualRow.start - printListScrollMargin
                    }px)`,
                  }}
                >
                  <CreatureThumbnail
                    className="print-creature-thumbnail"
                    entry={entry}
                    imageLoading="eager"
                    showHint={false}
                    onPreview={onPreview}
                    onBlurHash={onBlurHash}
                  />
                  <div className="print-creature-info">
                    <strong>{entry.name || "Unnamed creature"}</strong>
                    <span>{entry.creatureSize} · {entry.miniSize}mm</span>
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
              );
            })}
          </div>
        ) : entries.length === 0 ? (
          <div className="empty-state compact">
            <h3>Add creatures to your binder first</h3>
          </div>
        ) : (
          <div className="empty-state compact">
            <h3>No matching creatures</h3>
            <p>Try another search.</p>
          </div>
        )}
      </section>

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
        <span className="eyebrow">Export</span>
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
        <Button
          className="export-button"
          variant="contained"
          size="large"
          onClick={onGenerate}
          disabled={generating || total === 0}
          startIcon={generating ? <CircularProgress size={18} color="inherit" /> : undefined}
        >
          {generating ? "Generating PDF…" : "Export PDF"}
        </Button>
        </section>
      </aside>
    </div>
  );
}
