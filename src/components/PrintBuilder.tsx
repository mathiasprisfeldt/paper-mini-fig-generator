import { useMemo, useRef, useState } from "react";
import {
  Autocomplete,
  createFilterOptions,
  IconButton,
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
  return (
    <div className="print-layout">
      <section className="print-picker">
        <div className="section-toolbar">
          <div className="print-toolbar-actions">
            <input
              className="search-input print-search-input"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search creatures…"
              aria-label="Search print creatures"
            />
            <button
              className="btn btn-secondary"
              type="button"
              onClick={onQuickAdd}
              disabled={entries.length === 0}
            >
              Quick add
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={onClearSelection}
              disabled={total === 0}
            >
              Clear selection
            </button>
          </div>
        </div>

        {visibleEntries.length > 0 ? (
          <div className="print-creature-list">
            {visibleEntries.map((entry) => (
              <article className={`print-creature-row${entry.quantity ? " selected" : ""}`} key={entry.id}>
                <CreatureThumbnail
                  className="print-creature-thumbnail"
                  entry={entry}
                  showHint={false}
                  onPreview={onPreview}
                  onBlurHash={onBlurHash}
                />
                <div className="print-creature-info">
                  <strong>{entry.name || "Unnamed creature"}</strong>
                  <span>{entry.creatureSize} · {entry.miniSize}mm</span>
                </div>
                <div className="quantity-stepper" aria-label={`${entry.name} quantity`}>
                  <button
                    type="button"
                    aria-label={`Decrease ${entry.name || "unnamed creature"} quantity`}
                    onClick={() => onQuantityChange(entry.id, entry.quantity - 1)}
                    disabled={entry.quantity === 0}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    aria-label={`${entry.name || "Unnamed creature"} quantity`}
                    min={0}
                    max={99}
                    value={entry.quantity}
                    onChange={(event) => {
                      if (event.target.value !== "") {
                        onQuantityChange(entry.id, Number(event.target.value));
                      }
                    }}
                  />
                  <button
                    type="button"
                    aria-label={`Increase ${entry.name || "unnamed creature"} quantity`}
                    onClick={() => onQuantityChange(entry.id, entry.quantity + 1)}
                    disabled={entry.quantity >= 99}
                  >
                    +
                  </button>
                </div>
              </article>
            ))}
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
                <label className="form-control print-catalogue-name">
                  <span>Name</span>
                  <input
                    ref={renameInputRef}
                    value={catalogueNameDraft}
                    onChange={(event) => setCatalogueNameDraft(event.target.value)}
                    aria-label="Catalogue name"
                  />
                </label>
                <div className="print-catalogue-actions">
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => setRenamingCatalogue(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={!catalogueNameDraft.trim()}
                  >
                    Save
                  </button>
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
            className="format-picker"
            exclusive
            size="small"
            value={paperFormat}
            onChange={(_, format: PaperFormat | null) => {
              if (format) onPaperFormatChange(format);
            }}
            aria-label="Paper size"
          >
            {(["a4", "a3"] as PaperFormat[]).map((format) => (
              <ToggleButton
                key={format}
                className="format-btn"
                value={format}
              >
                {format.toUpperCase()}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>

        <div className="paper-format-control">
          <span>Page layout</span>
          <ToggleButtonGroup
            className="format-picker layout-picker"
            exclusive
            size="small"
            value={printLayout}
            onChange={(_, layout: PrintLayout | null) => {
              if (layout) onPrintLayoutChange(layout);
            }}
            aria-label="PDF page layout"
          >
            <ToggleButton className="format-btn" value="compact">
              Compact
            </ToggleButton>
            <ToggleButton className="format-btn" value="per-creature">
              Per creature
            </ToggleButton>
          </ToggleButtonGroup>
          <small className="layout-hint">
            Per creature starts each creature type on a separate page for easier cutting.
          </small>
        </div>

        {exportError && <p className="form-error">{exportError}</p>}
        <button
          className="btn btn-primary btn-large export-button"
          onClick={onGenerate}
          disabled={generating || total === 0}
        >
          {generating ? "Generating PDF…" : "Export PDF"}
        </button>
        </section>
      </aside>
    </div>
  );
}
