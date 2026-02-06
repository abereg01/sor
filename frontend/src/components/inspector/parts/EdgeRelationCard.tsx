import React from "react";

import type { FlowDirection, GraphLink, GraphNode } from "@/api/types";
import { relationLabelSv } from "@/components/inspector/utils/labels";
import { nodeName } from "@/components/inspector/utils/nodes";

function edgeDirPillClass(d: FlowDirection) {
  if (d === "source_to_target") return "edge-dir-pill edge-dir-pill--out";
  if (d === "target_to_source") return "edge-dir-pill edge-dir-pill--in";
  return "edge-dir-pill edge-dir-pill--bi";
}

export function EdgeRelationCard({
  selectedEdge,
  dirDraft,
  nodes,
  onSelectNode,
}: {
  selectedEdge: GraphLink;
  dirDraft: FlowDirection;
  nodes: GraphNode[];
  onSelectNode: (id: string) => void;
}) {
  return (
    <div className="card-light">
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Relation</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400, marginBottom: 6 }}>Relation</div>
          <div className={edgeDirPillClass(dirDraft)}>{relationLabelSv(selectedEdge.kind)}</div>
        </div>

        <div>
          <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400, marginBottom: 6 }}>Mål</div>
          <button
            type="button"
            className={edgeDirPillClass(dirDraft)}
            onClick={() => onSelectNode(selectedEdge.target)}
            style={{ width: "100%", textAlign: "left" }}
            title="Öppna nod"
          >
            {nodeName(nodes, selectedEdge.target)}
          </button>
        </div>
      </div>
    </div>
  );
}
