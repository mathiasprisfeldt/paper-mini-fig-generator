import { type KeyboardEventHandler, type ReactNode } from "react";
import { Dialog, DialogContent, IconButton } from "@mui/material";

interface Props {
  children: ReactNode;
  className?: string;
  backdropClassName?: string;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  closeOnEscape?: boolean;
  disableEnforceFocus?: boolean;
  onEntered?: () => void;
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
  disableEnforceFocus = false,
  onEntered,
  onKeyDown,
  onClose,
}: Props) {
  return (
    <Dialog
      open
      onClose={(_, reason) => {
        if (reason !== "escapeKeyDown" || closeOnEscape) onClose();
      }}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      disableEnforceFocus={disableEnforceFocus}
      maxWidth={false}
      slotProps={{
        backdrop: { className: backdropClassName },
        paper: { className: `app-dialog ${className}`.trim() },
        transition: { onEntered },
      }}
    >
      <DialogContent
        onKeyDown={onKeyDown}
        sx={{ padding: 0, overflow: "visible" }}
      >
        <IconButton
          className="dialog-close modal-shell-close"
          onClick={onClose}
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </IconButton>
        {children}
      </DialogContent>
    </Dialog>
  );
}
