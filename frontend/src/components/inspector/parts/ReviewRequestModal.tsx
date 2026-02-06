import React from "react";
import { Check } from "lucide-react";

import type { GraphLink, GraphNode } from "@/api/types";

export function ReviewRequestModal({
  open,
  createReviewLoading,
  reviewDescription,
  setReviewDescription,
  selectedEdge,
  selectedNode,
  nodes,
  onClose,
  onCreate,
}: {
  open: boolean;
  createReviewLoading: boolean;
  reviewDescription: string;
  setReviewDescription: React.Dispatch<React.SetStateAction<string>>;
  selectedEdge: GraphLink | null;
  selectedNode: GraphNode | null;
  nodes: GraphNode[];
  onClose: () => void;
  onCreate: () => void | Promise<void>;
}) {
  if (!open) return null;

  const desc = (reviewDescription ?? "").trim();
  const canSubmit = !!desc && !createReviewLoading;

  const edgeSubtitle = (() => {
    if (!selectedEdge) return "";
    const src = nodes.find((n) => n.id === (selectedEdge as any).source);
    const tgt = nodes.find((n) => n.id === (selectedEdge as any).target);
    const a = src?.name ?? String((selectedEdge as any).source ?? "");
    const b = tgt?.name ?? String((selectedEdge as any).target ?? "");
    if (a || b) return `${a} → ${b}`;
    return "";
  })();

  const subtitle = selectedNode ? selectedNode.name : selectedEdge ? edgeSubtitle : "";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 85,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div onClick={onClose} className="modal-overlay" style={{ position: "absolute", inset: 0 }} />

      <div
        className="panel-light modal-surface"
        role="dialog"
        aria-modal="true"
        style={{
          position: "relative",
          width: "min(640px, calc(100vw - 32px))",
          borderRadius: 14,
          boxShadow: "var(--shadow-soft)",
          overflow: "hidden",
          background: "white",
        }}
      >
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--panel-subtle-border)" }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Skapa granskning</div>
          {subtitle ? <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>{subtitle}</div> : null}
        </div>

        <div style={{ padding: 16, display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, opacity: 0.85 }}>Beskrivning</div>
            <textarea
              value={reviewDescription}
              onChange={(e) => setReviewDescription(e.target.value)}
              placeholder="Varför behöver detta granskas?"
              rows={5}
              style={{
                width: "100%",
                resize: "vertical",
                borderRadius: 12,
                border: "1px solid var(--panel-border-2)",
                padding: "10px 12px",
                outline: "none",
                background: "var(--panel-subtle-bg)",
              }}
            />
          </label>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            padding: 16,
            borderTop: "1px solid var(--panel-subtle-border)",
          }}
        >
          <button type="button" onClick={onClose} style={{ padding: "8px 12px" }}>
            Avbryt
          </button>
          <button
            type="button"
            onClick={() => void onCreate()}
            disabled={createReviewLoading || !canSubmit}
            style={{ padding: "8px 12px", opacity: createReviewLoading || !canSubmit ? 0.6 : 1 }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Check size={16} />
              Skicka till granskning
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
