import { useState } from "react";
import {
  Alert,
  AlertTitle,
  Button,
  CircularProgress,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { openDriveFolderPicker } from "../googleDrive";
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
  const [busySourceId, setBusySourceId] = useState<string | null>(null);
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

  const handleAddHtml = async () => {
    resetFeedback();
    let normalizedUrl: string;
    try {
      normalizedUrl = new URL(url.trim()).toString();
    } catch {
      setError("Enter a complete source URL, including https://");
      return;
    }
    if (!selector.trim()) {
      setError("Enter a CSS selector, such as a[href].");
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
    try {
      const folder = await openDriveFolderPicker({
        accessToken,
        appId,
        developerKey,
        origin: window.location.origin,
      });
      if (!folder) return;
      const count = await onAdd({
        type: "drive",
        name: name.trim() || folder.name,
        folderId: folder.id,
        folderName: folder.name,
      });
      setMessage(count === 0
        ? "Drive folder added. It is empty; refresh the source after adding images."
        : `Drive folder added with ${count} creature${count === 1 ? "" : "s"}.`);
      setName("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not read the Drive folder.");
    } finally {
      setBusySourceId(null);
    }
  };

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
      onClose={onClose}
    >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">Creature libraries</span>
            <h2 id="source-dialog-title">Sources</h2>
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
            <p className="dialog-intro">Add a directory page and select its image links with a CSS selector.</p>
            <div className="source-form">
              <TextField size="small" label="Source name" value={name} onChange={(event) => setName(event.target.value)} placeholder="My D&D artwork" />
              <TextField className="source-url-field" size="small" label="Page URL" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/creatures/" />
              <TextField size="small" label="HTML selector" value={selector} onChange={(event) => setSelector(event.target.value)} placeholder="a[href]" />
              <Button variant="contained" onClick={handleAddHtml} disabled={busySourceId !== null} startIcon={busySourceId === "new" ? <CircularProgress size={16} color="inherit" /> : undefined}>
                {busySourceId === "new" ? "Reading source…" : "Add HTML source"}
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
              <TextField className="drive-source-name" size="small" label="Source name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Defaults to the folder name" />
            </div>
            {!accessToken ? (
              <Alert className="source-requirement" severity="info">
                Connect Google Drive above before choosing a folder.
              </Alert>
            ) : !pickerConfigured ? (
              <Alert className="source-requirement" severity="warning">
                Drive folder sources require the Google Picker app ID and API key in this deployment.
              </Alert>
            ) : (
              <Button variant="contained" onClick={handleChooseDriveFolder} disabled={busySourceId !== null} startIcon={busySourceId === "new" ? <CircularProgress size={16} color="inherit" /> : undefined}>
                {busySourceId === "new" ? "Opening Drive…" : "Choose Drive folder"}
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
