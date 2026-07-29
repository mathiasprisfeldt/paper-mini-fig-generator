import { type KeyboardEventHandler, type ReactNode } from "react";
import { Dialog, DialogContent, IconButton } from "@mui/material";

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
  return (
    <Dialog
      open
      onClose={(_, reason) => {
        if (reason !== "escapeKeyDown" || closeOnEscape) onClose();
      }}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={backdropClassName}
      slotProps={{ paper: { className: `app-dialog ${className}`.trim() } }}
    >
      <DialogContent
        onKeyDown={onKeyDown}
        sx={{ padding: 0, overflow: "visible" }}
      >
        <IconButton
          className="dialog-close modal-shell-close"
          onClick={onClose}
          aria-label="Close"
          autoFocus
        >
          ×
        </IconButton>
        {children}
      </DialogContent>
    </Dialog>
  );
}
