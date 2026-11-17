import React, { useId } from "react";
import { Button } from "./ui/button";
import { DIALOG_OVERLAY_CLASS, DIALOG_PANEL_CLASS } from "./ui/dialog";
import { cn } from "../lib/utils";

// Delete confirmation. Same overlay, radius and z-index as the Radix dialogs (ui/dialog.jsx).
// The "confirm" and "cancel" class names are kept: tests select the buttons by them.
const ConfirmDialog = ({ message, onConfirm, onCancel }) => {
  const messageId = useId();

  return (
    <div className={cn(DIALOG_OVERLAY_CLASS, "flex items-center justify-center p-4")}>
      <div
        className={cn(DIALOG_PANEL_CLASS, "w-full max-w-sm")}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={messageId}
      >
        <p id={messageId} className="mb-6 text-base font-medium">{message}</p>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" className="cancel" onClick={onCancel}>ביטול</Button>
          <Button type="button" variant="destructive" className="confirm" onClick={onConfirm}>אישור</Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
