import { useCallback, useRef } from "react";
import type { MiniFigEntry, MiniSize, CreatureSize } from "../types";

interface Props {
  entry: MiniFigEntry;
  onUpdate: (patch: Partial<MiniFigEntry>) => void;
  onRemove?: () => void;
}

const MINI_SIZES: MiniSize[] = [24, 28, 32];

const CREATURE_SIZES: { value: CreatureSize; label: string }[] = [
  { value: "tiny", label: "Tiny" },
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "huge", label: "Huge" },
  { value: "gargantuan", label: "Gargantuan" },
];

export function MiniFigForm({ entry, onUpdate, onRemove }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        onUpdate({ imageDataUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    },
    [onUpdate]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file || !file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onload = () => {
        onUpdate({ imageDataUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    },
    [onUpdate]
  );

  return (
    <div className="mini-form">
      <div
        className={`image-upload ${entry.imageDataUrl ? "has-image" : ""}`}
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {entry.imageDataUrl ? (
          <img src={entry.imageDataUrl} alt="Mini preview" />
        ) : (
          <div className="upload-placeholder">
            <span className="upload-icon">📷</span>
            <span>Click or drop image</span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          hidden
        />
      </div>

      <div className="form-fields">
        <div className="field">
          <label>Name</label>
          <input
            type="text"
            value={entry.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="e.g. Goblin"
          />
        </div>

        <div className="field">
          <label>Quantity</label>
          <input
            type="number"
            min={1}
            max={99}
            value={entry.quantity}
            onChange={(e) =>
              onUpdate({ quantity: Math.max(1, parseInt(e.target.value) || 1) })
            }
          />
        </div>

        <div className="field">
          <label>Size</label>
          <select
            value={entry.creatureSize}
            onChange={(e) =>
              onUpdate({ creatureSize: e.target.value as CreatureSize })
            }
          >
            {CREATURE_SIZES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Scale</label>
          <select
            value={entry.miniSize}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              const size: MiniSize =
                val === 24 || val === 28 || val === 32 ? val : 28;
              onUpdate({ miniSize: size });
            }}
          >
            {MINI_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}mm
              </option>
            ))}
          </select>
        </div>

        <div className="field field-toggle">
          <label>
            <input
              type="checkbox"
              checked={entry.showName}
              onChange={(e) => onUpdate({ showName: e.target.checked })}
            />
            Show name on base
          </label>
        </div>
      </div>

      {onRemove && (
        <button
          className="btn btn-remove"
          onClick={onRemove}
          title="Remove miniature"
        >
          ✕
        </button>
      )}
    </div>
  );
}
