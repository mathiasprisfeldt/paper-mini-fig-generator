import { getEntryImageSource } from "../generatePdf";
import { DriveCreatureImage } from "../driveImages";
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
  const hasImage = Boolean(getEntryImageSource(entry) || entry.imageDriveFileId);

  return (
    <button
      className={`creature-thumbnail creature-preview-trigger ${className}`.trim()}
      type="button"
      onClick={() => onPreview(entry.id)}
      aria-label={`Preview ${entry.name || "creature"} export`}
    >
      {hasImage ? (
        <>
          <DriveCreatureImage
            entry={entry}
            className="creature-art-backdrop"
            alt=""
            aria-hidden="true"
          />
          <DriveCreatureImage
            entry={entry}
            className="creature-art-foreground"
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
