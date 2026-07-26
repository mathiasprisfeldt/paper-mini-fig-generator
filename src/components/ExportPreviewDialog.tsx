import { useEffect, useState } from "react";
import { getEffectiveWidthMm, renderPreview } from "../generatePdf";
import type { MiniFigEntry } from "../types";
import { AppModal } from "./AppModal";

interface Props {
  entry: MiniFigEntry;
  resolveEntry: (entry: MiniFigEntry) => Promise<MiniFigEntry>;
  onClose: () => void;
}

export function ExportPreviewDialog({ entry, resolveEntry, onClose }: Props) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");

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

        <div className="export-preview-stage">
          {!previewUrl && !error && <div className="preview-loading">Rendering preview…</div>}
          {error && <p className="form-error">{error}</p>}
          {previewUrl && (
            <img src={previewUrl} alt={`Foldable export layout for ${entry.name || "this creature"}`} />
          )}
        </div>

        <p className="export-preview-help">
          This is the strip placed in the PDF. Fold it between the mirrored and upright artwork.
        </p>
    </AppModal>
  );
}
