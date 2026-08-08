import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  IconButton,
  InputAdornment,
  TextField,
} from "@mui/material";
import type { MiniFigEntry, MiniSize, PrintableMiniFigEntry } from "../types";
import { FoldedMiniPreview } from "./FoldedMiniPreview";

interface Props {
  entries: PrintableMiniFigEntry[];
  miniSize: MiniSize;
  standBufferMm: number;
  resolveEntry: (entry: MiniFigEntry) => Promise<MiniFigEntry>;
  forcePlaceholder?: boolean;
  onStandBufferChange: (standBufferMm: number) => void;
}

const MAX_STAND_BUFFER_CM = 10;
const DEFAULT_STAND_BUFFER_CM = 1;

function hasPreviewImage(entry: PrintableMiniFigEntry): boolean {
  return Boolean(entry.imageDataUrl || entry.imageUrl || entry.imageDriveFileId);
}

function choosePreviewEntry(
  entries: PrintableMiniFigEntry[],
  excludedId?: string | null,
): PrintableMiniFigEntry | null {
  const eligibleEntries = entries.filter(hasPreviewImage);
  const candidates = eligibleEntries.length > 1
    ? eligibleEntries.filter((entry) => entry.id !== excludedId)
    : eligibleEntries;
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export function MiniFigStyle({
  entries,
  miniSize,
  standBufferMm,
  resolveEntry,
  forcePlaceholder = false,
  onStandBufferChange,
}: Props) {
  const [bufferCmInput, setBufferCmInput] = useState(
    () => (standBufferMm / 10).toFixed(1),
  );
  const [previewEntryId, setPreviewEntryId] = useState(
    () => choosePreviewEntry(entries)?.id ?? null,
  );
  const previewCandidates = useMemo(
    () => entries.filter(hasPreviewImage),
    [entries],
  );
  const previewEntry = useMemo(
    () => entries.find((entry) => entry.id === previewEntryId && hasPreviewImage(entry))
      ?? choosePreviewEntry(entries),
    [entries, previewEntryId],
  );
  const bufferCm = Number(bufferCmInput);
  const hasBufferError =
    bufferCmInput.trim() !== "" &&
    (!Number.isFinite(bufferCm) || bufferCm < 0 || bufferCm > MAX_STAND_BUFFER_CM);

  const handleBufferChange = (value: string) => {
    setBufferCmInput(value);
    const nextBufferCm = Number(value);
    if (
      value.trim() === "" ||
      !Number.isFinite(nextBufferCm) ||
      nextBufferCm < 0 ||
      nextBufferCm > MAX_STAND_BUFFER_CM
    ) {
      return;
    }
    onStandBufferChange(nextBufferCm * 10);
  };
  const resetDefaults = () => {
    setBufferCmInput(DEFAULT_STAND_BUFFER_CM.toFixed(1));
    onStandBufferChange(DEFAULT_STAND_BUFFER_CM * 10);
  };
  const chooseAnotherPreview = () => {
    const nextEntry = choosePreviewEntry(entries, previewEntry?.id);
    if (nextEntry) setPreviewEntryId(nextEntry.id);
  };

  return (
    <main className="mini-fig-style-view">
      <section className="mini-fig-style-settings">
        <header className="mini-fig-style-heading">
          <h2>Style</h2>
          <p>Configure how every miniature is prepared for its stand.</p>
        </header>
        <div className="mini-fig-style-panel">
          <div>
            <h3>Stand buffer</h3>
            <p>
              Add whitespace below each name so the paper can sit inside your
              miniature stand.
            </p>
          </div>
          <TextField
            label="Space below name"
            type="number"
            value={bufferCmInput}
            onChange={(event) => handleBufferChange(event.target.value)}
            error={hasBufferError}
            helperText={hasBufferError ? "Enter a value from 0 to 10 cm." : "Measure the part of the paper covered by your stand."}
            slotProps={{
              htmlInput: {
                min: 0,
                max: MAX_STAND_BUFFER_CM,
                step: 0.1,
              },
              input: {
                endAdornment: <InputAdornment position="end">cm</InputAdornment>,
              },
            }}
          />
          <Button
            className="mini-fig-style-reset"
            variant="outlined"
            onClick={resetDefaults}
            disabled={
              bufferCmInput === DEFAULT_STAND_BUFFER_CM.toFixed(1) &&
              standBufferMm === DEFAULT_STAND_BUFFER_CM * 10
            }
          >
            Reset to defaults
          </Button>
        </div>
      </section>
      <section className="mini-fig-style-preview" aria-label="Miniature export preview">
        {previewEntry ? (
          <FoldedMiniPreview
            key={previewEntry.id}
            entry={previewEntry}
            miniSize={miniSize}
            resolveEntry={resolveEntry}
            standBufferMm={standBufferMm}
            forcePlaceholder={forcePlaceholder}
            stageAction={
              <IconButton
                className="mini-fig-style-preview-refresh"
                aria-label="Show another creature"
                title="Show another creature"
                onClick={chooseAnotherPreview}
                disabled={previewCandidates.length < 2}
                sx={{
                  position: "absolute",
                  top: "16px",
                  right: "16px",
                  width: "40px",
                  height: "40px",
                  zIndex: 1,
                }}
              >
                <span aria-hidden="true">↻</span>
              </IconButton>
            }
          />
        ) : (
          <Alert severity="info">
            Add a creature with an image to see your miniature style.
          </Alert>
        )}
      </section>
    </main>
  );
}
