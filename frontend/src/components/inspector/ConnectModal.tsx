import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

import { InlineConnectBox } from "@/components/inspector/InlineConnectBox";

export function ConnectModal({
  open,
  fromNodeIds,
  onClose,
  onCreated,
  onError,
}: {
  open: boolean;
  fromNodeIds: string[];
  onClose: () => void;
  onCreated: () => void | Promise<void>;
  onError: (msg: string) => void;
}) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const portalTarget = useMemo(() => {
    if (typeof document === "undefined") return null;
    return document.body;
  }, []);

  if (!open || !portalTarget) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "var(--overlay-strong)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 14,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="panel-light"
        style={{
          width: "min(760px, 100%)",
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid var(--panel-border)",
          background: "var(--panel-bg)",
        }}
      >
        <div style={{ padding: "14px 14px 0 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Ny koppling</div>
          <button onClick={onClose} style={{ padding: "9px 10px" }}>
            Avbryt
          </button>
        </div>

        <div style={{ padding: "14px" }}>
          <InlineConnectBox fromNodeIds={fromNodeIds} onCreated={onCreated} onError={onError} />
        </div>
      </div>
    </div>,
    portalTarget
  );
}
