import type { FlowDirection, GraphLink, GraphNode } from "@/api/types";
import type { EdgeClaim } from "@/api/edgeClaims";

export function nodeById(nodes: GraphNode[]) {
  return new Map(nodes.map((n) => [n.id, n]));
}

export function nodeName(nodes: GraphNode[], id: string) {
  return nodes.find((n) => n.id === id)?.name ?? id;
}

export function pickCurrentClaim(claims: EdgeClaim[]): EdgeClaim | null {
  const active = claims.filter((c: any) => c.status === "active");
  if (active.length > 0) return active[0];
  const review = claims.filter((c: any) => c.status === "needs_review");
  if (review.length > 0) return review[0];
  return null;
}

export function directionLabelSv(d: FlowDirection) {
  if (d === "source_to_target") return "Källa → Mål";
  if (d === "target_to_source") return "Mål → Källa";
  if (d === "bidirectional") return "Dubbelriktad";
  return d;
}

export function relationLabelSv(kind: string) {
  const k = String(kind || "");
  const map: Record<string, string> = {
    depends_on: "Beroende av",
    runs_on: "Körs på",
    stores_data: "Lagrar data i",
    flows_to: "Flödar till",
    owned_by: "Ägs av",
    external_dependency: "Externt beroende",
    backs_up_to: "Backar upp till",
  };
  return map[k] ?? "Koppling";
}

export function yesNo(v: any) {
  if (typeof v === "boolean") return v ? "Ja" : "Nej";
  if (typeof v === "string") {
    if (v === "Ja" || v === "Nej") return v;
    if (v.toLowerCase() === "true") return "Ja";
    if (v.toLowerCase() === "false") return "Nej";
  }
  return "—";
}

export function textOrDash(v: any) {
  if (typeof v === "string" && v.trim() !== "") return v;
  if (typeof v === "number") return String(v);
  return "—";
}

export function metaTile(label: string, value: React.ReactNode) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: 10,
        borderRadius: 14,
        border: "1px solid var(--panel-subtle-border)",
        background: "var(--panel-subtle-bg)",
      }}
    >
      <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--panel-text)", lineHeight: 1.2 }}>{value}</div>
    </div>
  );
}

export function stripedDot() {
  return (
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: 99,
        display: "inline-block",
        background:
          "var(--grad-flow-stripes-dot)",
      }}
    />
  );
}

export function stripedBorder() {
  return "1px solid var(--panel-border)";
}

export function stripedBg() {
  return "var(--grad-flow-stripes-bg)";
}

export function dotForEdge(edge: GraphLink, focusNodeId: string) {
  if (edge.source === focusNodeId) {
    return (
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 99,
          background: "var(--accent)",
          display: "inline-block",
        }}
      />
    );
  }
  if (edge.target === focusNodeId) {
    return (
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 99,
          background: "var(--success)",
          display: "inline-block",
        }}
      />
    );
  }
  return (
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: 99,
        background: "var(--surface)",
        display: "inline-block",
      }}
    />
  );
}

export type RelationGroup = {
  key: string;
  otherId: string;
  kind: string;
  outEdge: GraphLink | null;
  inEdge: GraphLink | null;
};

export function groupRelationsForNode(nodeId: string, links: GraphLink[]): RelationGroup[] {
  const m = new Map<string, RelationGroup>();

  for (const e of links) {
    const isOut = e.source === nodeId;
    const isIn = e.target === nodeId;
    if (!isOut && !isIn) continue;

    const otherId = isOut ? e.target : e.source;
    const kind = e.kind;
    const key = `${kind}::${otherId}`;
    const g = m.get(key) ?? { key, otherId, kind, outEdge: null, inEdge: null };

    if (isOut) g.outEdge = e;
    if (isIn) g.inEdge = e;

    m.set(key, g);
  }

  return Array.from(m.values());
}

export function flowSummaryDir(flows: any[]): FlowDirection {
  const dirs = new Set<string>();
  for (const f of flows ?? []) dirs.add(String(f?.direction ?? "source_to_target"));
  if (dirs.has("bidirectional")) return "bidirectional";
  if (dirs.size > 1) return "bidirectional";
  const only = Array.from(dirs)[0] ?? "source_to_target";
  if (only === "target_to_source") return "target_to_source";
  return "source_to_target";
}
