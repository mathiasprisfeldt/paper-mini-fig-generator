import { useEffect, useState, useCallback } from "react";
import type { MiniFigEntry } from "../types";
import { renderPreview } from "../generatePdf";

interface Props {
  entry: MiniFigEntry;
}

export function MiniFigPreview({ entry }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const number = entry.quantity > 1 ? 1 : null;
      const url = await renderPreview(entry, number);
      if (!cancelled) setPreviewUrl(url);
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [entry]);

  const closeFullscreen = useCallback(() => setFullscreen(false), []);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  if (!previewUrl) {
    return (
      <div className="mini-preview empty">
        <span>Preview will appear here</span>
      </div>
    );
  }

  return (
    <>
      <div className="mini-preview" onClick={() => setFullscreen(true)}>
        <img src={previewUrl} alt={`${entry.name || "Mini"} preview`} />
        {entry.quantity > 1 && (
          <span className="preview-badge">×{entry.quantity}</span>
        )}
      </div>

      {fullscreen && (
        <div className="preview-overlay" onClick={closeFullscreen}>
          <img
            src={previewUrl}
            alt={`${entry.name || "Mini"} fullscreen`}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
