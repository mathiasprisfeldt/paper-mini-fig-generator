import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { Alert, CircularProgress } from "@mui/material";
import { renderPreview } from "../generatePdf";
import type {
  CreatureSize,
  MiniFigEntry,
  MiniSize,
  PrintableMiniFigEntry,
} from "../types";
import { AppModal } from "./AppModal";

interface Props {
  entry: PrintableMiniFigEntry;
  miniSize: MiniSize;
  resolveEntry: (entry: MiniFigEntry) => Promise<MiniFigEntry>;
  forcePlaceholder?: boolean;
  onUpdate: (id: string, patch: Partial<MiniFigEntry>) => void;
  onClose: () => void;
}

interface DragState {
  pointerId: number;
  x: number;
  rotation: number;
}

interface PreviewResult {
  key: string;
  url: string;
  aspect: number | null;
  error: string;
}

const INITIAL_ROTATION = -25;
const CREATURE_SIZES: CreatureSize[] = [
  "tiny", "small", "medium", "large", "huge", "gargantuan",
];

export function CreaturePreviewDialog({
  entry,
  miniSize,
  resolveEntry,
  forcePlaceholder = false,
  onUpdate,
  onClose,
}: Props) {
  const previewKey = JSON.stringify({ entry, miniSize });
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  // The rendered preview is a single vertical strip: a mirrored "back" copy of
  // the figure on top of the fold line, and the upright "front" copy below it
  // (see the LAYOUT GLOSSARY in generatePdf.ts). Because both bands and both
  // figure copies are always equal in height, that fold line sits at exactly
  // the vertical midpoint of the rendered image, so we can crop the top/bottom
  // halves with plain CSS instead of re-rendering anything.
  const [rotation, setRotation] = useState(INITIAL_ROTATION);
  const [isDragging, setIsDragging] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const dragState = useRef<DragState | null>(null);
  const isCurrentPreview = preview?.key === previewKey;
  const previewUrl = !forcePlaceholder && isCurrentPreview ? preview.url : "";
  const previewAspect = !forcePlaceholder && isCurrentPreview ? preview.aspect : null;
  const error = !forcePlaceholder && isCurrentPreview ? preview.error : "";
  const hasRenderedPreview = Boolean(previewUrl && previewAspect !== null);
  const isPreviewLoading = !hasRenderedPreview && !error;
  const figureAspect = previewAspect !== null ? previewAspect * 2 : 1.2;

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
    if (nextRotation === undefined) return;
    event.preventDefault();
    setHasInteracted(true);
    setRotation(nextRotation);
  };

  useEffect(() => {
    if (forcePlaceholder) return;

    let active = true;

    void resolveEntry(entry)
      .then((resolvedEntry) =>
        renderPreview(resolvedEntry, entry.quantity > 1 ? 1 : null, miniSize),
      )
      .then((url) => {
        if (!active) return;
        if (url) {
          const image = new Image();
          image.onload = () => {
            if (!active) return;
            setPreview({
              key: previewKey,
              url,
              aspect: image.naturalWidth / image.naturalHeight,
              error: "",
            });
          };
          image.onerror = () => {
            if (!active) return;
            setPreview({
              key: previewKey,
              url: "",
              aspect: null,
              error: "The rendered preview image could not be loaded.",
            });
          };
          image.src = url;
        } else {
          setPreview({
            key: previewKey,
            url: "",
            aspect: null,
            error: "This creature does not have an image to preview.",
          });
        }
      })
      .catch((caught: unknown) => {
        if (!active) return;
        const isCorsError = caught instanceof DOMException && caught.name === "SecurityError";
        setPreview({
          key: previewKey,
          url: "",
          aspect: null,
          error: isCorsError
            ? "The preview cannot be rendered because the image host does not allow cross-origin image exports."
            : caught instanceof Error ? caught.message : "The export preview could not be rendered.",
        });
      });

    return () => { active = false; };
  }, [entry, forcePlaceholder, miniSize, previewKey, resolveEntry]);

  return (
    <AppModal
      className="creature-preview-dialog"
      backdropClassName="creature-preview-backdrop"
      ariaLabel={`${entry.name || "Creature"} preview and properties`}
      onClose={onClose}
    >
      <header className="creature-preview-header">
        <h2>{entry.name || "Unnamed creature"}</h2>
      </header>
      <div className="creature-preview-workspace">
        <aside className="creature-preview-sidebar">
          <span className="eyebrow">Properties</span>
          <label className="creature-preview-name">
            <span>Name</span>
            <input
              value={entry.name}
              onChange={(event) => onUpdate(entry.id, { name: event.target.value })}
            />
          </label>
          <label className="creature-preview-select">
            <span>Size</span>
            <select
              value={entry.creatureSize}
              onChange={(event) =>
                onUpdate(entry.id, {
                  creatureSize: event.target.value as CreatureSize,
                })}
            >
              {CREATURE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size[0].toUpperCase() + size.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label className="creature-preview-checkbox">
            <input
              type="checkbox"
              checked={entry.showName}
              onChange={(event) => onUpdate(entry.id, { showName: event.target.checked })}
            />
            <span>Show name on base</span>
          </label>
        </aside>
        <div className="creature-preview-content">
          {error && <Alert severity="error">{error}</Alert>}
          <div className="creature-preview-stage">
            {isPreviewLoading && (
              <div className="creature-preview-loading" role="status">
                <CircularProgress size={32} />
                <span className="sr-only">Rendering {entry.name || "creature"} preview</span>
              </div>
            )}
            {hasRenderedPreview && (
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
                    aspectRatio: `${figureAspect}`,
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
            </div>
          </div>
        </div>
    </AppModal>
  );
}
