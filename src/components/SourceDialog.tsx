import { useState } from "react";
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
      normalizedUrl = new URL(url).toString();
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

        <div className="source-tabs source-type-tabs" aria-label="Source type">
          <button className={sourceType === "html" ? "active" : ""} onClick={() => { setSourceType("html"); resetFeedback(); }}>
            HTML page
          </button>
          <button className={sourceType === "drive" ? "active" : ""} onClick={() => { setSourceType("drive"); resetFeedback(); }}>
            Drive folder
          </button>
        </div>

        {sourceType === "html" ? (
          <>
            <p className="dialog-intro">Add a directory page and select its image links with a CSS selector.</p>
            <div className="source-form">
              <label className="form-control">
                <span>Source name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="My D&D artwork" />
              </label>
              <label className="form-control source-url-field">
                <span>Page URL</span>
                <input
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://example.com/creatures/"
                />
              </label>
              <label className="form-control">
                <span>HTML selector</span>
                <input value={selector} onChange={(event) => setSelector(event.target.value)} placeholder="a[href]" />
              </label>
              <button className="btn btn-primary" onClick={handleAddHtml} disabled={busySourceId !== null}>
                {busySourceId === "new" ? "Reading source…" : "Add HTML source"}
              </button>
            </div>
            <p className="form-help">
              Example: <code>a[href]</code> finds links such as <code>&lt;a href="Aerthos%20Vaal.png"&gt;</code>. Only image-file links are added.
            </p>
          </>
        ) : (
          <div className="drive-source-setup">
            <div className="drive-source-copy">
              <p>Select one folder from your Google Drive. Image files directly inside it become creatures in the binder.</p>
              <label className="form-control drive-source-name">
                <span>Source name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Defaults to the folder name"
                />
              </label>
            </div>
            {!accessToken ? (
              <p className="source-requirement">Connect Google Drive above before choosing a folder.</p>
            ) : !pickerConfigured ? (
              <p className="source-requirement">
                Drive folder sources require the Google Picker app ID and API key in this deployment.
              </p>
            ) : (
              <button className="btn btn-primary" onClick={handleChooseDriveFolder} disabled={busySourceId !== null}>
                {busySourceId === "new" ? "Opening Drive…" : "Choose Drive folder"}
              </button>
            )}
          </div>
        )}

        {message && <p className="form-success">{message}</p>}
        {error && <p className="form-error">{error}</p>}
        {showCorsHelp && (
          <div className="cors-help" role="alert">
            <strong>The browser could not read this source</strong>
            <p>First confirm the source opens in another tab. If it does, the most likely cause is a cross-origin (CORS) restriction; changing the selector will not fix it. The owner must return this header for the directory page and every image:</p>
            <pre>Access-Control-Allow-Origin: *</pre>
            <p>For Apache, add this to the site's <code>.htaccess</code> file:</p>
            <pre>{`<IfModule mod_headers.c>\n  Header always set Access-Control-Allow-Origin "*"\n  Header always set Access-Control-Allow-Methods "GET, OPTIONS"\n</IfModule>`}</pre>
            <p>If it still fails, check the connection, DNS, and hosting provider's firewall/WAF logs, then allow cross-origin GET requests to the image directory.</p>
          </div>
        )}

        {sources.length > 0 && (
          <div className="saved-sources">
            <h3>Saved sources</h3>
            {sources.map((source) => (
              <article className="saved-source" key={source.id}>
                <div>
                  {renamingSourceId === source.id ? (
                    <input
                      className="saved-source-name-input"
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
                      <button className="btn btn-primary" onClick={() => saveRename(source)}>Save</button>
                      <button className="btn btn-secondary" onClick={cancelRenaming}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-secondary" onClick={() => startRenaming(source)} disabled={busySourceId !== null || renamingSourceId !== null}>Rename</button>
                      <button className="btn btn-secondary" onClick={() => handleRefresh(source)} disabled={busySourceId !== null || renamingSourceId !== null || (source.type === "drive" && !accessToken)}>
                        {busySourceId === source.id ? "Refreshing…" : "Refresh"}
                      </button>
                      <button className="btn btn-danger-ghost" onClick={() => onRemove(source)} disabled={busySourceId !== null || renamingSourceId !== null}>Remove</button>
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
