import {
  useEffect,
  useRef,
  type KeyboardEventHandler,
  type ReactNode,
} from "react";

interface Props {
  children: ReactNode;
  className?: string;
  backdropClassName?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  closeOnEscape?: boolean;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
  onClose: () => void;
}

export function AppModal({
  children,
  className = "",
  backdropClassName = "",
  ariaLabel,
  ariaLabelledBy,
  closeOnEscape = true,
  onKeyDown,
  onClose,
}: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.contains(document.activeElement)) return;
    const autofocusTarget = dialog.querySelector<HTMLElement>("[autofocus]");
    (autofocusTarget ?? closeButtonRef.current)?.focus();
  }, []);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPaddingRight = document.body.style.paddingRight;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.paddingRight = previousBodyPaddingRight;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, []);

  useEffect(() => {
    if (!closeOnEscape) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [closeOnEscape, onClose]);

  return (
    <div
      className={`dialog-backdrop ${backdropClassName}`.trim()}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={`app-dialog ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        onKeyDown={onKeyDown}
      >
        <button
          ref={closeButtonRef}
          type="button"
          className="dialog-close modal-shell-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        {children}
      </section>
    </div>
  );
}
