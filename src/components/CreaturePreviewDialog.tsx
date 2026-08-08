import type {
  CreatureSize,
  MiniFigEntry,
  MiniSize,
  PrintableMiniFigEntry,
} from "../types";
import { AppModal } from "./AppModal";
import { FoldedMiniPreview } from "./FoldedMiniPreview";

interface Props {
  entry: PrintableMiniFigEntry;
  miniSize: MiniSize;
  resolveEntry: (entry: MiniFigEntry) => Promise<MiniFigEntry>;
  standBufferMm: number;
  forcePlaceholder?: boolean;
  onUpdate: (id: string, patch: Partial<MiniFigEntry>) => void;
  onClose: () => void;
}

const CREATURE_SIZES: CreatureSize[] = [
  "tiny", "small", "medium", "large", "huge", "gargantuan",
];

export function CreaturePreviewDialog({
  entry,
  miniSize,
  resolveEntry,
  standBufferMm,
  forcePlaceholder = false,
  onUpdate,
  onClose,
}: Props) {
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
          <FoldedMiniPreview
            entry={entry}
            miniSize={miniSize}
            resolveEntry={resolveEntry}
            standBufferMm={standBufferMm}
            forcePlaceholder={forcePlaceholder}
          />
          </div>
        </div>
    </AppModal>
  );
}
