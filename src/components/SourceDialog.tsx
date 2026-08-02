import { useState } from "react";
import {
  Alert,
  AlertTitle,
  Button,
  CircularProgress,
  InputAdornment,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@mui/material";
import {
  openDriveFolderPicker,
  type PickedDriveFolder,
} from "../googleDrive";
import type {
  CreatureSource,
  DriveCreatureSource,
  HtmlCreatureSource,
  SourceRefreshResult,
} from "../types";
import { useToast } from "../toastContext";
import { SourceAccessError } from "../sourceDiscovery";
import { AppModal } from "./AppModal";

export type SourceDraft =
  | Omit<HtmlCreatureSource, "id" | "updatedAt">
  | Omit<DriveCreatureSource, "id" | "updatedAt">;

interface Props {
  sources: CreatureSource[];
  accessToken: string | null;
  appId: string;
  developerKey: string;
  pickerConfigured: boolean;
  onAdd: (draft: SourceDraft) => Promise<number>;
  onRefresh: (source: CreatureSource) => Promise<SourceRefreshResult>;
  onRename: (source: CreatureSource, name: string) => void;
  onRemove: (source: CreatureSource) => void;
  onClose: () => void;
}

function normalizeSourceUrl(value: string): string | null {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function isValidCssSelector(value: string): boolean {
  if (!value.trim()) return false;
  try {
    document.querySelector(value);
    return true;
  } catch {
    return false;
  }
}

function FieldErrorAdornment({ message }: { message: string }) {
  return (
    <InputAdornment position="end" disablePointerEvents={false}>
      <Tooltip title={message} describeChild>
        <span className="source-field-error" tabIndex={0} aria-label={message}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v6m0 4h.01" />
          </svg>
        </span>
      </Tooltip>
    </InputAdornment>
  );
}

export function SourceDialog({
  sources,
  accessToken,
  appId,
  developerKey,
  pickerConfigured,
  onAdd,
  onRefresh,
  onRename,
  onRemove,
  onClose,
}: Props) {
  const { showToast } = useToast();
  const [sourceType, setSourceType] = useState<"html" | "drive">("html");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selector, setSelector] = useState("");
  const [urlTouched, setUrlTouched] = useState(false);
  const [selectorTouched, setSelectorTouched] = useState(false);
  const [selectedDriveFolder, setSelectedDriveFolder] =
    useState<PickedDriveFolder | null>(null);
  const [busySourceId, setBusySourceId] = useState<string | null>(null);
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const [renamingSourceId, setRenamingSourceId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showCorsHelp, setShowCorsHelp] = useState(false);

  const resetFeedback = () => {
    setError("");
    setMessage("");
    setShowCorsHelp(false);
  };

  const normalizedUrl = normalizeSourceUrl(url);
  const selectorIsValid = isValidCssSelector(selector);
  const canAddHtml = Boolean(normalizedUrl && selectorIsValid);
  const showUrlError = urlTouched && Boolean(url.trim()) && !normalizedUrl;
  const showSelectorError =
    selectorTouched && Boolean(selector.trim()) && !selectorIsValid;

  const handleAddHtml = async () => {
    resetFeedback();
    setUrlTouched(true);
    setSelectorTouched(true);
    if (!normalizedUrl || !selectorIsValid) {
      return;
    }

    setBusySourceId("new");
    try {
      const count = await onAdd({
        type: "html",
        name: name.trim() || new URL(normalizedUrl).hostname,
        url: normalizedUrl,
        selector: selector.trim(),
      });
      setMessage(`HTML source added with ${count} creature${count === 1 ? "" : "s"}.`);
      setName("");
    } catch (caught) {
      setShowCorsHelp(caught instanceof SourceAccessError);
      setError(caught instanceof Error ? caught.message : "Could not read the source.");
    } finally {
      setBusySourceId(null);
    }
  };

  const handleChooseDriveFolder = async () => {
    resetFeedback();
    if (!accessToken) {
      setError("Connect Google Drive before choosing a folder.");
      return;
    }
    setBusySourceId("new");
    setIsDrivePickerOpen(true);
    try {
      const folder = await openDriveFolderPicker({
        accessToken,
        appId,
        developerKey,
        origin: window.location.origin,
      });
      if (!folder) return;
      setSelectedDriveFolder(folder);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not choose the Drive folder.");
    } finally {
      setIsDrivePickerOpen(false);
      setBusySourceId(null);
    }
  };

  const handleAddDriveFolder = async () => {
    resetFeedback();
    if (!selectedDriveFolder) {
      setError("Choose a Google Drive folder first.");
      return;
    }

    setBusySourceId("new");
    try {
      const count = await onAdd({
        type: "drive",
        name: name.trim() || selectedDriveFolder.name,
        folderId: selectedDriveFolder.id,
        folderName: selectedDriveFolder.name,
      });
      setMessage(count === 0
        ? "Drive folder added. It is empty; refresh the source after adding images."
        : `Drive folder added with ${count} creature${count === 1 ? "" : "s"}.`);
      setName("");
      setSelectedDriveFolder(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read the Drive folder.");
    } finally {
      setBusySourceId(null);
    }
  };

  const canPickDriveFolder = Boolean(accessToken && pickerConfigured);

  const handleRefresh = async (source: CreatureSource) => {
    setBusySourceId(source.id);
    resetFeedback();
    try {
      const result = await onRefresh(source);
      showToast({
        tone: "success",
        title: `Refreshed ${source.name}`,
        message: `${result.added} added · ${result.removed} removed · ${result.total} total`,
      });
    } catch (caught) {
      setShowCorsHelp(caught instanceof SourceAccessError);
      const errorMessage = caught instanceof Error
        ? caught.message
        : "Could not refresh the source.";
      setError(errorMessage);
      showToast({
        tone: "error",
        title: `Could not refresh ${source.name}`,
        message: errorMessage,
      });
    } finally {
      setBusySourceId(null);
    }
  };

  const startRenaming = (source: CreatureSource) => {
    resetFeedback();
    setRenamingSourceId(source.id);
    setRenameValue(source.name);
  };

  const cancelRenaming = () => {
    setRenamingSourceId(null);
    setRenameValue("");
  };

  const saveRename = (source: CreatureSource) => {
    const nextName = renameValue.trim();
    if (!nextName) {
      setError("Give the source a name.");
      return;
    }
    onRename(source, nextName);
    setMessage(`Source renamed to ${nextName}.`);
    setError("");
    cancelRenaming();
  };

  return (
    <AppModal
      className="source-dialog"
      ariaLabelledBy="source-dialog-title"
      disableEnforceFocus={isDrivePickerOpen}
      onClose={onClose}
    >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">Creature libraries</span>
            <h2 id="source-dialog-title">Add source</h2>
          </div>
        </div>

        <ToggleButtonGroup
          className="source-tabs source-type-tabs"
          value={sourceType}
          exclusive
          size="small"
          onChange={(_, value: "html" | "drive" | null) => {
            if (!value) return;
            setSourceType(value);
            setUrlTouched(false);
            setSelectorTouched(false);
            resetFeedback();
          }}
          aria-label="Source type"
        >
          <ToggleButton value="html">
            HTML page
          </ToggleButton>
          <ToggleButton value="drive">
            Drive folder
          </ToggleButton>
        </ToggleButtonGroup>

        {sourceType === "html" ? (
          <>
            <div className="source-form">
              <p className="dialog-intro">Add a directory page and select its image links with a CSS selector.</p>
              <TextField size="small" label="Source name" value={name} onChange={(event) => setName(event.target.value)} placeholder="My D&D artwork" />
              <TextField
                className="source-url-field"
                size="small"
                label="Page URL"
                type="url"
                required
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value);
                  setError("");
                  setShowCorsHelp(false);
                }}
                onBlur={() => setUrlTouched(true)}
                error={showUrlError}
                slotProps={{
                  input: {
                    endAdornment: showUrlError
                      ? <FieldErrorAdornment message="Enter a complete http(s) URL." />
                      : undefined,
                  },
                }}
                placeholder="https://example.com/creatures/"
              />
              <TextField
                size="small"
                label="HTML selector"
                required
                value={selector}
                onChange={(event) => {
                  setSelector(event.target.value);
                  setError("");
                  setShowCorsHelp(false);
                }}
                onBlur={() => setSelectorTouched(true)}
                error={showSelectorError}
                slotProps={{
                  input: {
                    endAdornment: showSelectorError
                      ? <FieldErrorAdornment message="Enter a valid CSS selector." />
                      : undefined,
                  },
                }}
                placeholder="a[href]"
              />
              <Button variant="contained" onClick={handleAddHtml} disabled={!canAddHtml || busySourceId !== null} startIcon={busySourceId === "new" ? <CircularProgress size={16} color="inherit" /> : undefined}>
                {busySourceId === "new" ? "Reading source…" : "Add"}
              </Button>
            </div>
            <p className="form-help">
              Example: <code>a[href]</code> finds links such as <code>&lt;a href="Aerthos%20Vaal.png"&gt;</code>. Only image-file links are added.
            </p>
          </>
        ) : (
          <div className="drive-source-setup">
            <div className="drive-source-copy">
              <p>Select one folder from your Google Drive. Image files directly inside it become creatures in the binder.</p>
            </div>
            <TextField size="small" label="Source name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Defaults to the folder name" />
            <TextField
              className="drive-folder-field"
              size="small"
              label="Drive folder"
              required
              value={selectedDriveFolder?.name ?? ""}
              placeholder="Choose a folder"
              disabled={!canPickDriveFolder || busySourceId !== null}
              onClick={() => { void handleChooseDriveFolder(); }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                void handleChooseDriveFolder();
              }}
              slotProps={{
                input: {
                  readOnly: true,
                  "aria-haspopup": "dialog",
                },
              }}
            />
            {!accessToken ? (
              <Alert className="source-requirement" severity="info">
                Connect Google Drive above before choosing a folder.
              </Alert>
            ) : !pickerConfigured ? (
              <Alert className="source-requirement" severity="warning">
                Drive folder sources require the Google Picker app ID and API key in this deployment.
              </Alert>
            ) : (
              <Button variant="contained" onClick={handleAddDriveFolder} disabled={!selectedDriveFolder || busySourceId !== null}>
                {busySourceId === "new" ? "Adding…" : "Add"}
              </Button>
            )}
          </div>
        )}

        {message && <Alert severity="success">{message}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
        {showCorsHelp && (
          <Alert className="cors-help" severity="warning">
            <AlertTitle>The browser could not read this source</AlertTitle>
            <p>First confirm the source opens in another tab. If it does, the most likely cause is a cross-origin (CORS) restriction; changing the selector will not fix it. The owner must return this header for the directory page and every image:</p>
            <pre>Access-Control-Allow-Origin: *</pre>
            <p>For Apache, add this to the site's <code>.htaccess</code> file:</p>
            <pre>{`<IfModule mod_headers.c>\n  Header always set Access-Control-Allow-Origin "*"\n  Header always set Access-Control-Allow-Methods "GET, OPTIONS"\n</IfModule>`}</pre>
            <p>If it still fails, check the connection, DNS, and hosting provider's firewall/WAF logs, then allow cross-origin GET requests to the image directory.</p>
          </Alert>
        )}

        {sources.length > 0 && (
          <div className="saved-sources">
            <h3>Saved sources</h3>
            {sources.map((source) => (
              <article className="saved-source" key={source.id}>
                <div>
                  {renamingSourceId === source.id ? (
                    <TextField
                      className="saved-source-name-input"
                      size="small"
                      variant="standard"
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") saveRename(source);
                        if (event.key === "Escape") cancelRenaming();
                      }}
                      aria-label={`Rename ${source.name}`}
                      autoFocus
                    />
                  ) : (
                    <strong>{source.name}</strong>
                  )}
                  <span>{source.type === "html" ? source.url : `Google Drive · ${source.folderName}`}</span>
                  <code>{source.type === "html" ? source.selector : "Drive folder"}</code>
                </div>
                <div>
                  {renamingSourceId === source.id ? (
                    <>
                      <Button variant="contained" size="small" onClick={() => saveRename(source)}>Save</Button>
                      <Button variant="outlined" size="small" onClick={cancelRenaming}>Cancel</Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outlined" size="small" onClick={() => startRenaming(source)} disabled={busySourceId !== null || renamingSourceId !== null}>Rename</Button>
                      <Button variant="outlined" size="small" onClick={() => handleRefresh(source)} disabled={busySourceId !== null || renamingSourceId !== null || (source.type === "drive" && !accessToken)} startIcon={busySourceId === source.id ? <CircularProgress size={14} color="inherit" /> : undefined}>
                        {busySourceId === source.id ? "Refreshing…" : "Refresh"}
                      </Button>
                      <Button variant="outlined" color="error" size="small" onClick={() => onRemove(source)} disabled={busySourceId !== null || renamingSourceId !== null}>Remove</Button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
    </AppModal>
  );
}
