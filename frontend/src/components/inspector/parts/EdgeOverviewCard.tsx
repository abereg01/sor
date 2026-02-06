import type { FlowDirection, GraphLink, GraphNode } from "@/api/types";
import { directionLabelSv, metaTile, nodeName, relationLabelSv, textOrDash, yesNo } from "./inspectorUtils";

export function EdgeOverviewCard({
  selectedEdge,
  nodes,
  dirDraft,
  edgeMeta,
}: {
  selectedEdge: GraphLink;
  nodes: GraphNode[];
  dirDraft: FlowDirection;
  edgeMeta: any;
}) {
  return (
    <div className="card-light">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Översikt</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {metaTile("Relation", relationLabelSv(selectedEdge.kind))}
        {metaTile("Riktning", directionLabelSv(dirDraft))}
        {metaTile("Från", nodeName(nodes, selectedEdge.source))}
        {metaTile("Till", nodeName(nodes, selectedEdge.target))}
        {metaTile("Kritisk", yesNo(edgeMeta?.critical))}
        {metaTile("SLA", textOrDash(edgeMeta?.sla))}
        {metaTile("Domän", textOrDash(edgeMeta?.domain))}
        <div style={{ gridColumn: "1 / -1" }}>{metaTile("Beskrivning", textOrDash(edgeMeta?.description))}</div>
      </div>
    </div>
  );
}
