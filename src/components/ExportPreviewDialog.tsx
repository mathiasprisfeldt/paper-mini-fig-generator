import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Alert, FormControlLabel, Radio, RadioGroup } from "@mui/material";
import { getEffectiveWidthMm, renderPreview } from "../generatePdf";
import type { MiniFigEntry, PrintableMiniFigEntry } from "../types";
import { AppModal } from "./AppModal";

interface Props {
  entry: PrintableMiniFigEntry;
  resolveEntry: (entry: MiniFigEntry) => Promise<MiniFigEntry>;
  onClose: () => void;
}

interface DragState {
  pointerId: number;
  x: number;
  rotation: number;
}

const INITIAL_ROTATION = -25;

export function ExportPreviewDialog({ entry, resolveEntry, onClose }: Props) {
  const [previewUrl, setPreviewUrl] = useState("");
  // The rendered preview is a single vertical strip: a mirrored "back" copy of
  // the figure on top of the fold line, and the upright "front" copy below it
  // (see the LAYOUT GLOSSARY in generatePdf.ts). Because both bands and both
  // figure copies are always equal in height, that fold line sits at exactly
  // the vertical midpoint of the rendered image, so we can crop the top/bottom
  // halves with plain CSS instead of re-rendering anything.
  const [previewAspect, setPreviewAspect] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"folded" | "layout">("folded");
  const [rotation, setRotation] = useState(INITIAL_ROTATION);
  const [isDragging, setIsDragging] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const dragState = useRef<DragState | null>(null);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    setHasInteracted(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      rotation,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    setRotation(drag.rotation + (event.clientX - drag.x) * 0.55);
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (dragState.current?.pointerId !== event.pointerId) return;
    dragState.current = null;
    setIsDragging(false);
  };

  const handleRotationKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Partial<Record<typeof event.key, number>> = {
      ArrowLeft: rotation - 10,
      ArrowRight: rotation + 10,
      Home: INITIAL_ROTATION,
    };
    const nextRotation = steps[event.key];
    if (!nextRotation) return;
    event.preventDefault();
    setHasInteracted(true);
    setRotation(nextRotation);
  };

  useEffect(() => {
    let active = true;

    void resolveEntry(entry)
      .then((resolvedEntry) =>
        renderPreview(resolvedEntry, entry.quantity > 1 ? 1 : null),
      )
      .then((url) => {
        if (!active) return;
        if (url) {
          setPreviewUrl(url);
          const image = new Image();
          image.onload = () => {
            if (!active) return;
            setPreviewAspect(image.naturalWidth / image.naturalHeight);
          };
          image.src = url;
        } else {
          setError("This creature does not have an image to preview.");
        }
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

        <div className={`export-preview-stage ${mode === "folded" ? "folded" : ""}`}>
          {(!previewUrl || (mode === "folded" && previewAspect === null)) && !error && (
            <div className="preview-loading">Rendering preview…</div>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          {previewUrl && mode === "layout" && (
            <img src={previewUrl} alt={`Foldable export layout for ${entry.name || "this creature"}`} />
          )}
          {previewUrl && previewAspect !== null && mode === "folded" && (
            <div
              className={`miniature-3d-scene ${isDragging ? "is-dragging" : ""}`}
              role="img"
              aria-label={`Rotatable folded paper miniature of ${entry.name || "this creature"}. Drag horizontally or use the left and right arrow keys to view its front and back.`}
              tabIndex={0}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onKeyDown={handleRotationKey}
            >
              <div
                className={`miniature-3d-figure ${hasInteracted ? "" : "show-rotation-nudge"}`}
                aria-hidden="true"
                style={{
                  aspectRatio: `${previewAspect * 2}`,
                  transform: `rotateY(${rotation}deg)`,
                }}
              >
                <div className="miniature-3d-face miniature-3d-face-front">
                  <div
                    className="miniature-3d-face-art"
                    style={{ backgroundImage: `url(${previewUrl})` }}
                  />
                </div>
                <div className="miniature-3d-face miniature-3d-face-back">
                  <div
                    className="miniature-3d-face-art"
                    style={{ backgroundImage: `url(${previewUrl})` }}
                  />
                </div>
              </div>
            </div>
          )}
          <RadioGroup
            className="preview-mode-picker"
            value={mode}
            onChange={(event) => setMode(event.target.value as "folded" | "layout")}
            aria-label="Preview mode"
            row
          >
            <FormControlLabel value="folded" control={<Radio size="small" />} label="Folded" />
            <FormControlLabel value="layout" control={<Radio size="small" />} label="Printed" />
          </RadioGroup>
        </div>

        {mode === "layout" && (
          <p className="export-preview-help">
            This is the strip placed in the PDF. Fold it between the mirrored and upright artwork.
          </p>
        )}
    </AppModal>
  );
}
