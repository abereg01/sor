import type { FlowDirection, GraphLink, GraphNode } from "@/api/types";
import { InlineConnectBox } from "@/components/inspector/InlineConnectBox";
import {
  RelationGroup,
  dotForEdge,
  groupRelationsForNode,
  nodeById,
  relationLabelSv,
  stripedBg,
  stripedBorder,
  stripedDot,
} from "./inspectorUtils";

export function NodeRelationsCard({
  selectedNode,
  selectedNodeIds,
  links,
  nodes,
  onSelectEdge,
  onRefresh,
  onError,
  onSetBackNodeId,
  edgeDirById,
  setEdgeDirById,
  getEdgeClaimsForDir,
}: {
  selectedNode: GraphNode;
  selectedNodeIds: string[];
  links: GraphLink[];
  nodes: GraphNode[];
  onSelectEdge: (id: string) => void;
  onRefresh: () => void;
  onError: (msg: string) => void;
  onSetBackNodeId: (id: string) => void;
  edgeDirById: Record<string, FlowDirection | null>;
  setEdgeDirById: React.Dispatch<React.SetStateAction<Record<string, FlowDirection | null>>>;
  getEdgeClaimsForDir: (edgeId: string) => Promise<FlowDirection | null>;
}) {
  const byId = nodeById(nodes);
  const nodeRelationGroups: RelationGroup[] = groupRelationsForNode(selectedNode.id, links);

  return (
    <div className="card-light">
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Relation och mål</div>

      <InlineConnectBox
        fromNodeIds={
          selectedNodeIds && selectedNodeIds.length > 0
            ? Array.from(new Set(selectedNodeIds.map(String)))
            : [String(selectedNode.id)]
        }
        onCreated={onRefresh}
        onError={onError}
      />

      <div style={{ height: 12 }} />

      {nodeRelationGroups.length === 0 ? (
        <div style={{ color: "var(--panel-muted)", fontSize: 13 }}>Inga kopplingar.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10 }}>
          {nodeRelationGroups.map((g) => {
            const other = byId.get(g.otherId);
            const name = other?.name ?? g.otherId;
            const kindSv = relationLabelSv(g.kind);

            const hasOut = !!g.outEdge;
            const hasIn = !!g.inEdge;

            const openEdgeId = g.outEdge?.id ?? g.inEdge?.id ?? "";
            const claimDir = openEdgeId ? edgeDirById[openEdgeId] : null;

            const isStriped = (hasOut && hasIn) || claimDir === "bidirectional";

            const arrow = isStriped ? "↔" : hasOut ? "→" : "←";
            const dot = isStriped
              ? stripedDot()
              : hasOut && g.outEdge
              ? dotForEdge(g.outEdge, selectedNode.id)
              : hasIn && g.inEdge
              ? dotForEdge(g.inEdge, selectedNode.id)
              : stripedDot();

            const border = isStriped ? stripedBorder() : hasOut ? "1px solid var(--info-border)" : "1px solid var(--success-border)";
            const bg = isStriped ? stripedBg() : hasOut ? "var(--info-bg)" : "var(--success-bg)";

            return (
              <button
                key={g.key}
                onClick={async () => {
                  onSetBackNodeId(selectedNode.id);
                  if (openEdgeId) {
                    if (edgeDirById[openEdgeId] == null) {
                      const d = await getEdgeClaimsForDir(openEdgeId);
                      setEdgeDirById((prev) => ({ ...prev, [openEdgeId]: d }));
                    }
                    onSelectEdge(openEdgeId);
                  }
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 10px",
                  borderRadius: 14,
                  border,
                  background: bg,
                  color: "var(--panel-text)",
                }}
                title={name}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {dot}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {arrow} {name}
                    </div>
                    <div style={{ marginTop: 2, fontSize: 12, color: "var(--panel-text-2)", fontWeight: 600 }}>
                      {kindSv}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
