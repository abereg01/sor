import { Trash2, X } from "lucide-react";
import type { GraphLink, GraphNode } from "@/api/types";
import { deleteEdge, deleteNode } from "@/api/client";
import { nodeName } from "./inspectorUtils";

type Props = {
  selectedNode: GraphNode | null;
  selectedEdge: GraphLink | null;
  multiSelectedCount: number;
  onCloseAndClear: () => void;
  onError: (msg: string) => void;
  onRefresh: () => void;
  onAfterDelete: () => void;

  onStartCreateReview: () => void;
  canCreateReview: boolean;
};

export function InspectorHeaderCard({
  selectedNode,
  selectedEdge,
  multiSelectedCount,
  onCloseAndClear,
  onError,
  onRefresh,
  onAfterDelete,
  onStartCreateReview,
  canCreateReview,
}: Props) {
  return (
    <div
      className="card-light"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        padding: "12px 12px",
      }}
    >
      <div style={{ minWidth: 0 }}>
        {selectedEdge ? (
          <>
            <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400 }}>Koppling</div>
            <div style={{ marginTop: 4, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {nodeName([selectedNode as any].filter(Boolean) as any, "")}
            </div>
          </>
        ) : multiSelectedCount > 1 ? (
          <>
            <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400 }}>Valda noder</div>
            <div style={{ marginTop: 4, fontWeight: 600 }}>{multiSelectedCount} st</div>
          </>
        ) : selectedNode ? (
          <>
            <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400 }}>Nod</div>
            <div style={{ marginTop: 4, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {selectedNode.name}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: "var(--panel-muted)" }}>Välj en nod eller koppling.</div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        {canCreateReview ? (
          <button onClick={onStartCreateReview} title="Skicka till granskning" aria-label="Skicka till granskning" style={{ padding: "8px 10px" }}>
            📝
          </button>
        ) : null}

        {selectedEdge ? (
          <button
            onClick={async () => {
              const ok = window.confirm("Ta bort kopplingen? Detta kan inte ångras.");
              if (!ok) return;

              try {
                await deleteEdge(selectedEdge.id, selectedEdge.etag);
                onRefresh();
                onAfterDelete();
              } catch (e: any) {
                onError(e?.message ?? String(e));
              }
            }}
            title="Ta bort koppling"
            aria-label="Ta bort koppling"
            style={{ padding: "8px 10px" }}
          >
            <Trash2 size={16} />
          </button>
        ) : selectedNode ? (
          <button
            onClick={async () => {
              const ok = window.confirm("Ta bort noden? Detta kan inte ångras.");
              if (!ok) return;

              try {
                await deleteNode(selectedNode.id, selectedNode.etag);
                onRefresh();
                onAfterDelete();
              } catch (e: any) {
                onError(e?.message ?? String(e));
              }
            }}
            title="Ta bort nod"
            aria-label="Ta bort nod"
            style={{ padding: "8px 10px" }}
          >
            <Trash2 size={16} />
          </button>
        ) : null}

        <button onClick={onCloseAndClear} title="Stäng" aria-label="Stäng" style={{ padding: "8px 10px" }}>
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
