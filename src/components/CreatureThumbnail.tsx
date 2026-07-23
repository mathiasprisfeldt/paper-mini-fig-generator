import { getEntryImageSource } from "../generatePdf";
import type { MiniFigEntry } from "../types";

interface Props {
  entry: MiniFigEntry;
  className?: string;
  showSelection?: boolean;
  showHint?: boolean;
  onPreview: (id: string) => void;
}

export function CreatureThumbnail({
  entry,
  className = "",
  showSelection = false,
  showHint = true,
  onPreview,
}: Props) {
  const imageSource = getEntryImageSource(entry);

  return (
    <button
      className={`creature-thumbnail creature-preview-trigger ${className}`.trim()}
      type="button"
      onClick={() => onPreview(entry.id)}
      aria-label={`Preview ${entry.name || "creature"} export`}
    >
      {imageSource ? (
        <>
          <img
            className="creature-art-backdrop"
            src={imageSource}
            alt=""
            aria-hidden="true"
          />
          <img
            className="creature-art-foreground"
            src={imageSource}
            alt=""
          />
        </>
      ) : (
        <span className="creature-thumbnail-empty" aria-hidden="true">◇</span>
      )}
      {showSelection && entry.quantity > 0 && (
        <span className="selected-badge">{entry.quantity} selected</span>
      )}
      {showHint && (
        <span className="preview-hint" aria-hidden="true">Preview print</span>
      )}
    </button>
  );
}
