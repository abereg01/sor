import React, { useEffect } from "react";
import { isTypingTarget } from "@/lib/dom";

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};


export function ConfirmModal({
  open,
  title,
  message,
  confirmText = "Bekräfta",
  cancelText = "Avbryt",
  danger = false,
  onConfirm,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={onClose}
        className="modal-overlay"
        style={{
          position: "absolute",
          inset: 0,
        }}
      />

      <div
        className="panel-light modal-surface"
        role="dialog"
        aria-modal="true"
        style={{
          position: "relative",
          width: "min(560px, calc(100vw - 32px))",
          borderRadius: 14,
          boxShadow: "var(--shadow-soft)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "12px 14px",
            borderBottom: "1px solid var(--panel-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: danger ? "var(--danger)" : "var(--accent)",
                boxShadow: danger ? "0 0 0 4px var(--danger-bg)" : "0 0 0 4px var(--focus-ring)",
                flexShrink: 0,
              }}
            />
            <div
              style={{
                fontWeight: 600,
                color: "var(--panel-text)",
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
              }}
            >
              {title}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              border: "1px solid var(--panel-border)",
              background: "var(--panel-bg)",
              borderRadius: 10,
              padding: "6px 10px",
              cursor: "pointer",
              color: "var(--panel-text)",
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            Esc
          </button>
        </div>

        <div style={{ padding: "12px 14px", color: "var(--panel-text)", lineHeight: 1.45, fontWeight: 650 }}>
          {message}
        </div>

        <div
          style={{
            padding: "12px 14px",
            borderTop: "1px solid var(--panel-border)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--panel-border)",
              background: "var(--panel-bg)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--panel-border)",
              background: danger ? "var(--danger-bg)" : "var(--info-bg)",
              color: "var(--panel-text)",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
