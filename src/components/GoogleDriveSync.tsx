import { Alert, Button, Chip, CircularProgress } from "@mui/material";

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
  onDownloadBackup: () => void;
}

export function GoogleDriveSync({
  configured,
  connected,
  status,
  message,
  autosyncEnabled,
  onConnect,
  onDisconnect,
  onDownloadBackup,
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
          {autosyncEnabled && <Chip size="small" color="success" label="Autosync on" />}
        </div>
        <p>{message}</p>
        {!configured && (
          <Alert className="drive-configuration-error" severity="error">
            Google Drive is not configured for this deployment. The site
            administrator must add the Google OAuth settings and reload the app.
          </Alert>
        )}
        {!connected && (
          <Alert className="drive-local-warning" severity="warning">
            Local only: until Drive is connected, your creatures and settings will be lost if this site's cache or browser storage is cleared.
          </Alert>
        )}
      </div>

      <div className="drive-sync-actions">
        {!connected ? (
          <Button
            variant="contained"
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
            onClick={onConnect}
            disabled={!configured || busy}
            title={!configured ? "Google Drive setup is required" : undefined}
          >
            {!configured
              ? "Setup required"
              : status === "connecting"
              ? "Connecting…"
              : status === "syncing"
                ? "Loading Drive…"
                : "Connect Drive"}
          </Button>
        ) : (
          <>
            <Button
              variant="outlined"
              startIcon={status === "syncing" ? <CircularProgress size={16} color="inherit" /> : undefined}
              onClick={onDownloadBackup}
              disabled={busy}
            >
              {status === "syncing" ? "Syncing…" : "Download backup"}
            </Button>
            <Button variant="outlined" color="error" onClick={onDisconnect}>
              Disconnect
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
