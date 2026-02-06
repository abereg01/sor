import React, { useEffect } from "react";
import { isTypingTarget } from "@/lib/dom";

type Props = {
  open: boolean;
  title?: string;
  message: string;
  onClose: () => void;
};


export function ErrorModal({ open, title = "Fel", message, onClose }: Props) {
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
        zIndex: 70,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: 16,
        pointerEvents: "none",
      }}
    >
      <div
        className="panel-light"
        role="dialog"
        aria-modal="true"
        style={{
          pointerEvents: "auto",
          width: "min(760px, calc(100vw - 32px))",
          marginTop: 10,
          borderRadius: 14,
          border: "1px solid var(--danger-border)",
          background: "var(--panel-bg-2)",
          boxShadow: "var(--shadow-soft)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "10px 12px",
            borderBottom: "1px solid var(--danger-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: "var(--danger)",
                boxShadow: "0 0 0 4px var(--danger-bg)",
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
              border: "1px solid var(--border-0)",
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

        <div style={{ padding: "10px 12px", color: "var(--panel-text)", fontWeight: 600, lineHeight: 1.4 }}>
          {message}
        </div>
      </div>
    </div>
  );
}

export default ErrorModal;
