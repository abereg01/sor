import { useEffect, useMemo, useState } from "react";
import type { GraphNode } from "@/api/types";
import {
  listEdgesNeedingReview,
  listNodesNeedingReview,
  type NeedsReviewEdge,
  type NeedsReviewNode,
} from "@/api/review";

type UnifiedCase =
  | { kind: "edge"; created_at: string; created_by: string; edge: NeedsReviewEdge }
  | { kind: "node"; created_at: string; created_by: string; node: NeedsReviewNode };

type Props = {
  nodes: GraphNode[];
  onSelectEdge: (edgeId: string) => void;
  onSelectNode?: (nodeId: string) => void;
  onError: (msg: string) => void;
  refreshToken?: any;
};

function nodeName(nodesById: Map<string, GraphNode>, id: string): string {
  return nodesById.get(id)?.name ?? id.slice(0, 8);
}

function safeWhen(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("sv-SE", { hour12: false });
}

export default function NeedsReviewPanel({ nodes, onSelectEdge, onSelectNode, onError, refreshToken }: Props) {
  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const [edges, setEdges] = useState<NeedsReviewEdge[]>([]);
  const [nodeCases, setNodeCases] = useState<NeedsReviewNode[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [e, n] = await Promise.all([
        listEdgesNeedingReview().catch(() => [] as NeedsReviewEdge[]),
        listNodesNeedingReview().catch(() => [] as NeedsReviewNode[]),
      ]);
      setEdges(e);
      setNodeCases(n);
    } catch (err: any) {
      onError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [refreshToken]);

  useEffect(() => {
    const handler = () => void load();
    window.addEventListener("reviews:changed", handler);
    return () => window.removeEventListener("reviews:changed", handler);
  }, []);

  const cases: UnifiedCase[] = useMemo(() => {
    const out: UnifiedCase[] = [];
    for (const e of edges) out.push({ kind: "edge", created_at: e.created_at, created_by: e.created_by, edge: e });
    for (const n of nodeCases) out.push({ kind: "node", created_at: n.created_at, created_by: n.created_by, node: n });
    out.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
    return out;
  }, [edges, nodeCases]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 600 }}>Granska</div>
        {loading ? <div style={{ opacity: 0.7, fontSize: 12 }}>Laddar…</div> : null}
      </div>

      {cases.length === 0 ? (
        <div style={{ opacity: 0.8, fontSize: 13 }}>Inga ärenden just nu.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {cases.map((c) => {
            const isEdge = c.kind === "edge";
            const label = isEdge ? "Koppling" : "Nod";

            const title = isEdge
              ? `${nodeName(nodesById, c.edge.from_id)} → ${nodeName(nodesById, c.edge.to_id)}`
              : c.node.name;

            const when = safeWhen(c.created_at);

            const descRaw = isEdge
              ? (c.edge as any).description ?? (c.edge as any).source
              : (c.node as any).description ?? (c.node as any).source;

            const desc = typeof descRaw === "string" ? descRaw.trim() : "";

            const bg = isEdge ? "var(--warning-bg)" : "var(--info-bg)";
            const border = isEdge ? "var(--warning-border)" : "var(--info-border)";
            const badgeBg = isEdge ? "var(--warning-bg)" : "var(--info-bg)";
            const badgeBorder = isEdge ? "var(--warning-border)" : "var(--info-border)";

            return (
              <button
                key={isEdge ? `e:${c.edge.edge_id}` : `n:${c.node.node_id}`}
                onClick={() => (isEdge ? onSelectEdge(c.edge.edge_id) : onSelectNode?.(c.node.node_id))}
                style={{
                  textAlign: "left",
                  padding: 10,
                  borderRadius: 10,
                  border: `1px solid ${border}`,
                  background: bg,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {title}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 999,
                      border: `1px solid ${badgeBorder}`,
                      background: badgeBg,
                      opacity: 0.95,
                      flex: "0 0 auto",
                    }}
                  >
                    {label}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 6, fontSize: 12, opacity: 0.88 }}>
                  <span>Skapad av: {c.created_by}</span>
                  {when ? (
                    <>
                      <span>•</span>
                      <span>{when}</span>
                    </>
                  ) : null}
                </div>

                {desc ? (
                  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.92 }}>
                    {desc.length > 120 ? `${desc.slice(0, 120)}…` : desc}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
