import {
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from "react";
import { Alert, AlertTitle, IconButton, Snackbar } from "@mui/material";
import {
  ToastContext,
  type ToastInput,
  type ToastItem,
} from "../toastContext";

interface Props {
  children: ReactNode;
}

const DEFAULT_DURATION = 5000;
const MAX_QUEUED_TOASTS = 4;

export function ToastProvider({ children }: Props) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const currentToast = toasts[0];

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((input: ToastInput) => {
    const nextToast: ToastItem = {
      ...input,
      id: crypto.randomUUID(),
      tone: input.tone ?? "info",
    };
    setToasts((current) =>
      [...current, nextToast].slice(-MAX_QUEUED_TOASTS)
    );
  }, []);

  const context = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={context}>
      {children}
      {currentToast && (
        <Snackbar
          key={currentToast.id}
          open
          autoHideDuration={currentToast.duration ?? DEFAULT_DURATION}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          onClose={(_, reason) => {
            if (reason !== "clickaway") dismissToast(currentToast.id);
          }}
        >
          <Alert
            severity={currentToast.tone}
            variant="filled"
            action={
              <IconButton
                size="small"
                color="inherit"
                onClick={() => dismissToast(currentToast.id)}
                aria-label="Dismiss notification"
              >
                <span aria-hidden="true">×</span>
              </IconButton>
            }
            sx={{ width: "min(390px, calc(100vw - 2rem))" }}
          >
            <AlertTitle>{currentToast.title}</AlertTitle>
            {currentToast.message}
          </Alert>
        </Snackbar>
      )}
    </ToastContext.Provider>
  );
}
