import React from "react";

import type { GraphNode } from "@/api/types";
import { nodeName } from "@/components/inspector/utils/nodes";

export function NewConnectionCard({
  visible,
  nodeIds,
  nodes,
  onCreate,
}: {
  visible: boolean;
  nodeIds: string[];
  nodes: GraphNode[];
  onCreate: () => void;
}) {
  if (!visible) return null;
  const a = nodeIds[0] ?? "";
  const b = nodeIds[1] ?? "";

  return (
    <div className="card-light">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>Ny koppling</div>
        <button type="button" onClick={onCreate} style={{ padding: "8px 10px" }}>
          Lägg till koppling
        </button>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: "var(--panel-muted)", fontWeight: 400 }}>
        {nodeName(nodes, a)} ↔ {nodeName(nodes, b)}
      </div>
    </div>
  );
}
