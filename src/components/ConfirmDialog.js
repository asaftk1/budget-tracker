import React from "react";
import "./ConfirmDialog.css"; // ניצור אותו גם עוד רגע

const ConfirmDialog = ({ message, onConfirm, onCancel }) => {
  return (
    <div className="confirm-dialog-backdrop">
      <div className="confirm-dialog">
        <p>{message}</p>
        <div className="confirm-dialog-buttons">
          <button className="cancel" onClick={onCancel}>ביטול</button>
          <button className="confirm" onClick={onConfirm}>אישור</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
