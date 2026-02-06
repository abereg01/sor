import type { GraphNode } from "@/api/types";
import { metaTile, textOrDash, yesNo } from "./inspectorUtils";

export function NodeOverviewCard({ selectedNode }: { selectedNode: GraphNode }) {
  const nodeMeta = selectedNode.metadata ?? {};

  return (
    <div className="card-light">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Översikt</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {metaTile("Ägare", textOrDash((nodeMeta as any).owner_team))}
        {metaTile("Backup-policy", textOrDash((nodeMeta as any).backup_policy))}
        <div style={{ gridColumn: "1 / -1" }}>{metaTile("Beskrivning", textOrDash((nodeMeta as any).description))}</div>
        {metaTile("Miljö", textOrDash((nodeMeta as any).env))}
        {metaTile("Kritisk", yesNo((nodeMeta as any).critical))}
      </div>
    </div>
  );
}
