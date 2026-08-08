import { AlertTriangle } from "lucide-react";

import Modal from "./Modal";

import Button from "./Button";

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm",
  message = "Are you sure?",
  confirmText = "Confirm",
  variant = "danger",
}) => (
  <Modal isOpen={isOpen} onClose={onClose} size="sm">
    <div className="text-center py-2">
      <div
        className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${variant === "danger" ? "bg-danger/10" : "bg-warning/10"}`}
      >
        <AlertTriangle
          className={`h-6 w-6 ${variant === "danger" ? "text-danger" : "text-warning"}`}
        />
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-[var(--color-text)] mb-2">
        {title}
      </h3>
      <p className="text-sm text-[var(--color-text-secondary)]">{message}</p>
    </div>
    <div className="flex justify-center gap-3 mt-6">
      <Button variant="outline" onClick={onClose}>
        Cancel
      </Button>
      <Button variant={variant} onClick={onConfirm}>
        {confirmText}
      </Button>
    </div>
  </Modal>
);
export default ConfirmDialog;