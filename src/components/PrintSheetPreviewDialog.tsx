import { useEffect, useMemo, useState } from "react";
import { Alert, CircularProgress } from "@mui/material";
import { renderPrintSheetPreview } from "../generatePdf";
import type {
  MiniFigEntry,
  MiniSize,
  PaperFormat,
  PrintableMiniFigEntry,
  PrintLayout,
} from "../types";
import { AppModal } from "./AppModal";

interface Props {
  entries: PrintableMiniFigEntry[];
  format: PaperFormat;
  layout: PrintLayout;
  miniSize: MiniSize;
  resolveEntries: (entries: MiniFigEntry[]) => Promise<MiniFigEntry[]>;
  autoPrint?: boolean;
  onClose: () => void;
}

interface PreviewResult {
  key: string;
  url: string;
  error: string;
}

export function PrintSheetPreviewDialog({
  entries,
  format,
  layout,
  miniSize,
  resolveEntries,
  autoPrint = false,
  onClose,
}: Props) {
  const selectedEntries = useMemo(
    () => entries.filter((entry) => entry.quantity > 0),
    [entries],
  );
  const previewKey = JSON.stringify({ selectedEntries, format, layout, miniSize });
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const isCurrentPreview = preview?.key === previewKey;
  const previewUrl = isCurrentPreview ? preview.url : "";
  const error = isCurrentPreview ? preview.error : "";

  useEffect(() => {
    let active = true;
    let previewUrlToRevoke = "";

    void resolveEntries(selectedEntries)
      .then((resolvedEntries) => {
        const quantityById = new Map(
          selectedEntries.map((entry) => [entry.id, entry.quantity]),
        );
        return renderPrintSheetPreview(
          resolvedEntries.map((entry) => ({
            ...entry,
            quantity: quantityById.get(entry.id) ?? 0,
          })),
          format,
          layout,
          miniSize,
        );
      })
      .then((blob) => {
        if (!active) return;
        if (!blob) {
          setPreview({
            key: previewKey,
            url: "",
            error: "Select at least one creature with an image to preview the sheet.",
          });
          return;
        }
        previewUrlToRevoke = URL.createObjectURL(blob);
        setPreview({ key: previewKey, url: previewUrlToRevoke, error: "" });
      })
      .catch((caught: unknown) => {
        if (!active) return;
        const isCorsError = caught instanceof DOMException && caught.name === "SecurityError";
        const message = caught instanceof Error
          ? caught.message
          : "The print preview could not be rendered.";
        setPreview({
          key: previewKey,
          url: "",
          error: isCorsError
            ? `${message.replace(/[.\s]+$/, "")}. Check that linked image hosts allow CORS.`
            : message,
        });
      });

    return () => {
      active = false;
      if (previewUrlToRevoke) URL.revokeObjectURL(previewUrlToRevoke);
    };
  }, [format, layout, miniSize, previewKey, resolveEntries, selectedEntries]);

  const total = selectedEntries.reduce((sum, entry) => sum + entry.quantity, 0);

  return (
    <AppModal
      className="print-sheet-preview-dialog"
      ariaLabelledBy="print-sheet-preview-title"
      onClose={onClose}
    >
      <div className="print-sheet-preview">
        <header className="print-sheet-preview-header">
          <div>
            <span className="eyebrow">Export preview</span>
            <h2 id="print-sheet-preview-title">Your print sheet</h2>
            <p>
              {total} miniature{total === 1 ? "" : "s"} · {format.toUpperCase()} · {miniSize}mm ·{" "}
              {layout === "compact" ? "Compact layout" : "Per-creature layout"}
            </p>
          </div>
        </header>
        <div className="print-sheet-preview-stage">
          {!previewUrl && !error && (
            <div className="print-sheet-preview-loading">
              <CircularProgress size={28} />
              <span>Rendering print sheet…</span>
            </div>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          {previewUrl && (
            <iframe
              className="print-sheet-preview-frame"
              src={previewUrl}
              title="Generated print sheet preview"
              onLoad={(event) => {
                if (!autoPrint) return;
                event.currentTarget.contentWindow?.print();
              }}
            />
          )}
        </div>
      </div>
    </AppModal>
  );
}
