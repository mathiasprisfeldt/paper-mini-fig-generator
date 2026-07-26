import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ToastContext,
  type ToastInput,
  type ToastItem,
} from "../toastContext";

interface Props {
  children: ReactNode;
}

const DEFAULT_DURATION = 5000;

export function ToastProvider({ children }: Props) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, number>());

  const dismissToast = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((input: ToastInput) => {
    const id = crypto.randomUUID();
    const duration = input.duration ?? DEFAULT_DURATION;
    setToasts((current) => [
      ...current.slice(-3),
      { ...input, id, tone: input.tone ?? "info" },
    ]);

    if (duration > 0) {
      const timer = window.setTimeout(() => {
        timers.current.delete(id);
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, duration);
      timers.current.set(id, timer);
    }
  }, []);

  useEffect(() => () => {
    for (const timer of timers.current.values()) {
      window.clearTimeout(timer);
    }
    timers.current.clear();
  }, []);

  const context = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={context}>
      {children}
      <div
        className="toast-viewport"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((toast) => (
          <div
            className={`app-toast app-toast-${toast.tone}`}
            role={toast.tone === "error" ? "alert" : "status"}
            key={toast.id}
          >
            <span className="app-toast-icon" aria-hidden="true">
              {toast.tone === "success" ? "✓" : toast.tone === "error" ? "!" : "i"}
            </span>
            <div className="app-toast-copy">
              <strong>{toast.title}</strong>
              {toast.message && <p>{toast.message}</p>}
            </div>
            <button
              className="app-toast-close"
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
