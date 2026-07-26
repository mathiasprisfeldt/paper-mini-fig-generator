import { useRef, useState } from "react";
import type { CreatureSize, MiniFigEntry, MiniSize } from "../types";

interface Props {
  uploadEnabled: boolean;
  onAdd: (entry: MiniFigEntry) => void | Promise<void>;
  onCancel?: () => void;
}

const CREATURE_SIZES: CreatureSize[] = [
  "tiny",
  "small",
  "medium",
  "large",
  "huge",
  "gargantuan",
];
const MINI_SIZES: MiniSize[] = [24, 28, 32];

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result as string), {
      once: true,
    });
    reader.addEventListener("error", () => reject(reader.error), { once: true });
    reader.readAsDataURL(file);
  });
}

async function validateImageUrl(value: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a complete image URL, including https://");
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error("The image URL must use http or https.");
  }
  if (window.location.protocol === "https:" && url.protocol === "http:") {
    throw new Error(
      "Use an https:// image URL. Browsers block http:// images on secure pages.",
    );
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), { mode: "cors" });
  } catch (error) {
    throw new Error(
      "The browser could not read this image. The host may be blocking cross-origin access, or the network may be unavailable. Enable CORS for the site or upload the file instead.",
      { cause: error },
    );
  }
  if (!response.ok) throw new Error(`The image host returned ${response.status}.`);

  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) {
    throw new Error("That URL does not return an image.");
  }

  return url.toString();
}

export function AddCreatureForm({ uploadEnabled, onAdd, onCancel }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sourceMode, setSourceMode] = useState<"upload" | "url">(
    uploadEnabled ? "upload" : "url",
  );
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [creatureSize, setCreatureSize] = useState<CreatureSize>("medium");
  const [miniSize, setMiniSize] = useState<MiniSize>(28);
  const [showName, setShowName] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);

  const reset = () => {
    setName("");
    setFile(null);
    setImageUrl("");
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleAdd = async () => {
    if (sourceMode === "upload" && !uploadEnabled) {
      setError("Connect Google Drive and load or save your binder before uploading images.");
      return;
    }
    if (!name.trim()) {
      setError("Give the creature a name.");
      return;
    }
    if (sourceMode === "upload" && !file) {
      setError("Choose an image to upload.");
      return;
    }
    if (sourceMode === "url" && !imageUrl.trim()) {
      setError("Paste a direct link to an image.");
      return;
    }

    setAdding(true);
    setError("");
    try {
      const source =
        sourceMode === "upload"
          ? { imageDataUrl: await readFile(file!), imageUrl: null }
          : { imageDataUrl: null, imageUrl: await validateImageUrl(imageUrl.trim()) };

      await onAdd({
        id: crypto.randomUUID(),
        name: name.trim(),
        ...source,
        imageDriveFileId: null,
        sourceId: null,
        quantity: 0,
        showName,
        miniSize,
        creatureSize,
      });
      reset();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add the creature.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className="add-creature-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">New creature</span>
          <h2>Add to your binder</h2>
        </div>
        <div className="source-tabs" aria-label="Image source">
          <button
            className={`${sourceMode === "upload" ? "active " : ""}${!uploadEnabled ? "requires-drive" : ""}`.trim()}
            onClick={() => {
              if (!uploadEnabled) {
                setError("Connect Google Drive and load or save your binder before uploading images.");
                return;
              }
              setSourceMode("upload");
              setError("");
            }}
            aria-describedby={!uploadEnabled ? "upload-drive-requirement" : undefined}
            title={uploadEnabled ? "Upload an image to Google Drive" : "Connect and sync Google Drive first"}
            data-tooltip={!uploadEnabled ? "Connect Drive and enable autosync to upload images" : undefined}
          >
            <span>Upload image</span>
            {!uploadEnabled && <span className="drive-required-badge">Drive required</span>}
          </button>
          <button
            className={sourceMode === "url" ? "active" : ""}
            onClick={() => setSourceMode("url")}
          >
            Image URL
          </button>
        </div>
      </div>

      <div className="add-creature-grid">
        <label className="form-control form-control-name">
          <span>Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Owlbear"
          />
        </label>

        {sourceMode === "upload" ? (
          <label className="form-control form-control-source" key="upload-source">
            <span>Image file</span>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
        ) : (
          <label className="form-control form-control-source" key="url-source">
            <span>Direct image URL</span>
            <input
              type="url"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://example.com/images/owlbear.png"
            />
          </label>
        )}

        <label className="form-control">
          <span>Creature size</span>
          <select
            value={creatureSize}
            onChange={(event) => setCreatureSize(event.target.value as CreatureSize)}
          >
            {CREATURE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size[0].toUpperCase() + size.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label className="form-control">
          <span>Mini scale</span>
          <select
            value={miniSize}
            onChange={(event) => setMiniSize(Number(event.target.value) as MiniSize)}
          >
            {MINI_SIZES.map((size) => (
              <option key={size} value={size}>{size}mm</option>
            ))}
          </select>
        </label>

        <label className="toggle-control">
          <input
            type="checkbox"
            checked={showName}
            onChange={(event) => setShowName(event.target.checked)}
          />
          Print name on base
        </label>

        <div className="dialog-form-actions">
          {onCancel && <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>}
          <button className="btn btn-primary add-creature-button" onClick={handleAdd} disabled={adding}>
            {adding ? (sourceMode === "upload" ? "Saving to Drive…" : "Checking image…") : "Add creature"}
          </button>
        </div>
      </div>

      {!uploadEnabled && (
        <p className="form-help upload-drive-requirement" id="upload-drive-requirement">
          <strong>Google Drive required for uploads.</strong> Connect Drive, then load or save your binder to enable autosync. Image links can still be added without Drive.
        </p>
      )}
      {sourceMode === "url" && (
        <p className="form-help">
          Paste the full link to an image file. The host must allow cross-origin access for PDF export.
        </p>
      )}
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
