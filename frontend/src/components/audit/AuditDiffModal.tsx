import { useEffect } from "react";
import { isTypingTarget } from "@/lib/dom";

import type { AuditLogEntry } from "@/api/audit";
import { prettyJson } from "@/lib/auditHuman";

type Props = {
  open: boolean;
  entry: AuditLogEntry | null;
  onClose: () => void;
};


function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400, marginBottom: 6 }}>{title}</div>
      <pre
        style={{
          fontSize: 12,
          overflow: "auto",
          maxHeight: 320,
          margin: 0,
          padding: 10,
          borderRadius: 12,
          background: "var(--panel-subtle-bg)",
        }}
      >
        {value ? prettyJson(value) : "—"}
      </pre>
    </div>
  );
}

export function AuditDiffModal({ open, entry, onClose }: Props) {
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

  if (!open || !entry) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
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
          width: "min(980px, calc(100vw - 32px))",
          maxHeight: "min(84vh, 860px)",
          borderRadius: 14,
          boxShadow: "var(--shadow-soft)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
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
                background: "var(--accent)",
                boxShadow: "0 0 0 4px var(--focus-ring)",
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
              Diff
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
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            Esc
          </button>
        </div>

        <div
          style={{
            padding: "12px 14px",
            overflow: "auto",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <JsonBlock title="Före" value={entry.before} />
            <JsonBlock title="Efter" value={entry.after} />
            <div style={{ gridColumn: "1 / -1" }}>
              <JsonBlock title="Ändring" value={entry.patch} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
