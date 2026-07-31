import { useRef, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
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

function readableImageName(value: string): string {
  const withoutExtension = value.replace(/\.[^.]+$/, "");
  return (withoutExtension || value)
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameFromFile(file: File): string {
  return readableImageName(file.name);
}

function nameFromImageUrl(value: string): string | null {
  try {
    const filename = new URL(value).pathname.split("/").pop();
    if (!filename) return null;
    let decoded = filename;
    try {
      decoded = decodeURIComponent(filename);
    } catch {
      // Keep the encoded filename if it contains malformed escapes.
    }
    return readableImageName(decoded) || null;
  } catch {
    return null;
  }
}

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

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  await response.body?.cancel();
  if (!contentType.startsWith("image/")) {
    throw new Error("That URL does not return an image.");
  }

  return url.toString();
}

export function AddCreatureForm({ uploadEnabled, onAdd, onCancel }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestedName = useRef<string | null>(null);
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
    suggestedName.current = null;
    setName("");
    setFile(null);
    setImageUrl("");
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFileChange = (selectedFile: File | null) => {
    setFile(selectedFile);
    setError("");
    setName((currentName) => {
      const previousSuggestion = suggestedName.current;
      if (!selectedFile) {
        suggestedName.current = null;
        return currentName === previousSuggestion ? "" : currentName;
      }

      const nextSuggestion = nameFromFile(selectedFile);
      if (!currentName.trim() || currentName === previousSuggestion) {
        suggestedName.current = nextSuggestion;
        return nextSuggestion;
      }
      return currentName;
    });
  };

  const handleImageUrlChange = (value: string) => {
    setImageUrl(value);
    setError("");
    setName((currentName) => {
      const previousSuggestion = suggestedName.current;
      const nextSuggestion = nameFromImageUrl(value);
      if (!nextSuggestion) {
        suggestedName.current = null;
        return currentName === previousSuggestion ? "" : currentName;
      }
      if (!currentName.trim() || currentName === previousSuggestion) {
        suggestedName.current = nextSuggestion;
        return nextSuggestion;
      }
      return currentName;
    });
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
        blurHash: null,
        sourceId: null,
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
        <ToggleButtonGroup
          className="source-tabs"
          value={sourceMode}
          exclusive
          onChange={(_, val: "upload" | "url" | null) => {
            if (!val) return;
            if (val === "upload" && !uploadEnabled) {
              setError("Connect Google Drive and load or save your binder before uploading images.");
              return;
            }
            setSourceMode(val);
            setError("");
          }}
          aria-label="Image source"
        >
          <ToggleButton
            value="upload"
            className={!uploadEnabled ? "requires-drive" : ""}
            aria-describedby={!uploadEnabled ? "upload-drive-requirement" : undefined}
            title={uploadEnabled ? "Upload an image to Google Drive" : "Connect and sync Google Drive first"}
            data-tooltip={!uploadEnabled ? "Connect Drive and enable autosync to upload images" : undefined}
          >
            <span>Upload image</span>
            {!uploadEnabled && <span className="drive-required-badge">Drive required</span>}
          </ToggleButton>
          <ToggleButton value="url">Image URL</ToggleButton>
        </ToggleButtonGroup>
      </div>

      <div className="add-creature-grid">
        <TextField
          fullWidth
          size="small"
          label="Name"
          value={name}
          onChange={(event) => {
            suggestedName.current = null;
            setName(event.target.value);
          }}
          placeholder="e.g. Owlbear"
        />

        {sourceMode === "upload" ? (
          <div key="upload-source" style={{ minWidth: 0 }}>
            <TextField
              fullWidth
              size="small"
              label="Image file"
              value={file ? file.name : ""}
              slotProps={{
                input: {
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <Button
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          inputRef.current?.click();
                        }}
                      >
                        Browse
                      </Button>
                    </InputAdornment>
                  ),
                },
                htmlInput: { style: { cursor: "pointer" } },
              }}
              onClick={() => inputRef.current?.click()}
            />
            {/* Native file input stays visually hidden; triggered by the Browse button */}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(event) =>
                handleFileChange(event.target.files?.[0] ?? null)
              }
            />
          </div>
        ) : (
          <TextField
            key="url-source"
            fullWidth
            size="small"
            label="Direct image URL"
            type="url"
            value={imageUrl}
            onChange={(event) => handleImageUrlChange(event.target.value)}
            placeholder="https://example.com/images/owlbear.png"
          />
        )}

        <FormControl size="small" fullWidth>
          <InputLabel id="creature-size-label">Creature size</InputLabel>
          <Select
            labelId="creature-size-label"
            value={creatureSize}
            label="Creature size"
            onChange={(event) => setCreatureSize(event.target.value as CreatureSize)}
          >
            {CREATURE_SIZES.map((size) => (
              <MenuItem key={size} value={size}>
                {size[0].toUpperCase() + size.slice(1)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" fullWidth>
          <InputLabel id="mini-size-label">Mini scale</InputLabel>
          <Select
            labelId="mini-size-label"
            value={miniSize}
            label="Mini scale"
            onChange={(event) => setMiniSize(Number(event.target.value) as MiniSize)}
          >
            {MINI_SIZES.map((size) => (
              <MenuItem key={size} value={size}>{size}mm</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControlLabel
          className="toggle-control"
          sx={{ margin: 0, alignSelf: "center" }}
          control={
            <Checkbox
              checked={showName}
              onChange={(event) => setShowName(event.target.checked)}
              size="small"
            />
          }
          label="Print name on base"
        />

        <div className="dialog-form-actions">
          {onCancel && (
            <Button variant="outlined" size="small" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button
            variant="contained"
            size="small"
            onClick={handleAdd}
            disabled={adding}
          >
            {adding ? (sourceMode === "upload" ? "Saving to Drive…" : "Checking image…") : "Add creature"}
          </Button>
        </div>
      </div>

      {!uploadEnabled && (
        <Alert
          severity="warning"
          id="upload-drive-requirement"
          sx={{ mt: 1, fontSize: "0.75rem", lineHeight: 1.45 }}
        >
          <strong>Google Drive required for uploads.</strong> Connect Drive, then load or save your binder to enable autosync. Image links can still be added without Drive.
        </Alert>
      )}
      {sourceMode === "url" && (
        <Alert severity="info" sx={{ mt: 1, fontSize: "0.75rem", lineHeight: 1.45 }}>
          Paste the full link to an image file. The host must allow cross-origin access for PDF export.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}
    </section>
  );
}
