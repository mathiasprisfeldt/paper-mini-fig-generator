export type DriveSyncStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "syncing"
  | "synced"
  | "error";

interface Props {
  configured: boolean;
  connected: boolean;
  status: DriveSyncStatus;
  message: string;
  autosyncEnabled: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onLoad: () => void;
  onSave: () => void;
}

export function GoogleDriveSync({
  configured,
  connected,
  status,
  message,
  autosyncEnabled,
  onConnect,
  onDisconnect,
  onLoad,
  onSave,
}: Props) {
  const busy = status === "connecting" || status === "syncing";

  return (
    <section className={`drive-sync drive-sync-${status}`}>
      <div className="drive-sync-copy">
        <div className="drive-sync-title">
          <span className="drive-sync-icon" aria-hidden="true">
            ▲
          </span>
          <strong>Google Drive</strong>
          {autosyncEnabled && <span className="drive-sync-badge">Autosync on</span>}
        </div>
        <p>{message}</p>
        {!connected && (
          <p className="drive-local-warning" role="status">
            <span aria-hidden="true">⚠</span>
            <span>
              Local only: until Drive is connected, your creatures and settings will be lost if this site's cache or browser storage is cleared.
            </span>
          </p>
        )}
      </div>

      <div className="drive-sync-actions">
        {!connected ? (
          <button
            className="btn btn-drive"
            onClick={onConnect}
            disabled={!configured || busy}
          >
            {status === "connecting" ? "Connecting…" : "Connect Drive"}
          </button>
        ) : (
          <>
            <button className="btn btn-secondary btn-disconnect" onClick={onDisconnect}>
              Disconnect
            </button>
            <button className="btn btn-secondary" onClick={onLoad} disabled={busy}>
              Load from Drive
            </button>
            <button className="btn btn-drive" onClick={onSave} disabled={busy}>
              {status === "syncing" ? "Saving…" : "Save to Drive"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
