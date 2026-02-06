import React from "react";
import { ClipboardList, Pencil, Trash2, X } from "lucide-react";
import type { GraphLink, GraphNode } from "@/api/types";

export function InspectorHeader({
  selectedNode,
  selectedEdge,
  graphColorForKind,
  createReviewLoading,
  reviewRequested,
  onEdit,
  onReview,
  onDeleteNode,
  onDeleteEdge,
  onClose,
}: {
  selectedNode: GraphNode | null;
  selectedEdge: GraphLink | null;
  graphColorForKind: (kind: string) => string;
  createReviewLoading: boolean;
  reviewRequested: boolean;
  onEdit: () => void;
  onReview: () => void;
  onDeleteNode: () => void;
  onDeleteEdge: () => void;
  onClose: () => void;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
      <div style={{ fontWeight: 600, fontSize: 14, minWidth: 0 }}>
        {selectedEdge ? (
          "Koppling"
        ) : selectedNode ? (
          <>
            Objekt{" "}
            <span style={{ color: graphColorForKind(String(selectedNode.kind ?? "default")) }}>{selectedNode.name}</span>
          </>
        ) : (
          "Inspektör"
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {(selectedNode || selectedEdge) ? (
          <button onClick={onEdit} title="Redigera" aria-label="Redigera" style={{ padding: "8px 10px" }}>
            <Pencil size={16} />
          </button>
        ) : null}

        {(selectedNode || selectedEdge) ? (
          <button
            onClick={onReview}
            title={reviewRequested ? "Granskning redan begärd" : "Granska"}
            aria-label="Granska"
            disabled={createReviewLoading || reviewRequested}
            style={{ padding: "8px 10px", opacity: createReviewLoading || reviewRequested ? 0.6 : 1 }}
          >
            <ClipboardList size={16} />
          </button>
        ) : null}

        {selectedNode ? (
          <button onClick={onDeleteNode} title="Ta bort nod" aria-label="Ta bort nod" style={{ padding: "8px 10px" }}>
            <Trash2 size={16} />
          </button>
        ) : null}

        {selectedEdge ? (
          <button onClick={onDeleteEdge} title="Ta bort koppling" aria-label="Ta bort koppling" style={{ padding: "8px 10px" }}>
            <Trash2 size={16} />
          </button>
        ) : null}

        <button onClick={onClose} title="Stäng" aria-label="Stäng" style={{ padding: "8px 10px" }}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
