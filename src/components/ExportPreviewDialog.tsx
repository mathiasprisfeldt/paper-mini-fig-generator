import { useEffect, useState } from "react";
import { Tab, Tabs } from "@mui/material";
import { getEffectiveWidthMm, renderPreview } from "../generatePdf";
import type { MiniFigEntry, PrintableMiniFigEntry } from "../types";
import { AppModal } from "./AppModal";

interface Props {
  entry: PrintableMiniFigEntry;
  resolveEntry: (entry: MiniFigEntry) => Promise<MiniFigEntry>;
  onClose: () => void;
}

export function ExportPreviewDialog({ entry, resolveEntry, onClose }: Props) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"folded" | "layout">("folded");

  useEffect(() => {
    let active = true;

    void resolveEntry(entry)
      .then((resolvedEntry) =>
        renderPreview(resolvedEntry, entry.quantity > 1 ? 1 : null),
      )
      .then((url) => {
        if (!active) return;
        if (url) setPreviewUrl(url);
        else setError("This creature does not have an image to preview.");
      })
      .catch((caught: unknown) => {
        if (!active) return;
        const isCorsError = caught instanceof DOMException && caught.name === "SecurityError";
        setError(isCorsError
          ? "The preview cannot be rendered because the image host does not allow cross-origin image exports."
          : caught instanceof Error ? caught.message : "The export preview could not be rendered.");
      });

    return () => { active = false; };
  }, [entry, resolveEntry]);

  return (
    <AppModal
      className="export-preview-dialog"
      backdropClassName="export-preview-backdrop"
      ariaLabel={`${entry.name || "Creature"} export preview`}
      onClose={onClose}
    >
        <header className="export-preview-header">
          <div>
            <span className="eyebrow">Export preview</span>
            <h2>{entry.name || "Unnamed creature"}</h2>
            <p>{entry.creatureSize} · {getEffectiveWidthMm(entry)}mm printed width</p>
          </div>
        </header>

        <Tabs
          value={mode}
          onChange={(_, value: "folded" | "layout") => setMode(value)}
          aria-label="Preview mode"
          centered
        >
          <Tab value="folded" label="Folded 3D" />
          <Tab value="layout" label="Print layout" />
        </Tabs>

        <div className={`export-preview-stage ${mode === "folded" ? "folded" : ""}`}>
          {!previewUrl && !error && <div className="preview-loading">Rendering preview…</div>}
          {error && <p className="form-error">{error}</p>}
          {previewUrl && mode === "layout" && (
            <img src={previewUrl} alt={`Foldable export layout for ${entry.name || "this creature"}`} />
          )}
          {previewUrl && mode === "folded" && (
            <div
              className="miniature-3d-scene"
              role="img"
              aria-label={`Folded three-dimensional paper miniature of ${entry.name || "this creature"}`}
            >
              <div className="miniature-3d-figure" aria-hidden="true">
                <img src={previewUrl} alt="" />
              </div>
              <div className="miniature-3d-base" aria-hidden="true" />
            </div>
          )}
        </div>

        <p className="export-preview-help">
          {mode === "folded"
            ? "A folded representation of the miniature and its standing base."
            : "This is the strip placed in the PDF. Fold it between the mirrored and upright artwork."}
        </p>
    </AppModal>
  );
}
