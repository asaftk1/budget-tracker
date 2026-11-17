import React, { useId } from "react";
import "./ConfirmDialog.css";

const ConfirmDialog = ({ message, onConfirm, onCancel }) => {
  const messageId = useId();

  return (
    <div className="confirm-dialog-backdrop">
      <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={messageId}>
        <p id={messageId}>{message}</p>
        <div className="confirm-dialog-buttons">
          <button type="button" className="cancel" onClick={onCancel}>ביטול</button>
          <button type="button" className="confirm" onClick={onConfirm}>אישור</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
