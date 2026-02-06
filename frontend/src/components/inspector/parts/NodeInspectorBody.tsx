import React from "react";

import type { GraphLink, GraphNode, SchemaKindsResponse } from "@/api/types";
import type { NodeDetailsResponse } from "@/api/nodeDetails";
import type { NodeClaim } from "@/api/nodeClaims";

import { businessCriticalityLabelSv, deptLabelSv, informationClassLabelSv, supplierTypeLabelSv } from "@/lib/nodeDetailsValidation";

import { metaTile } from "@/components/inspector/parts/MetaTile";
import { stripedBg, stripedBorder } from "@/components/inspector/parts/inspectorUtils";
import { nodeKindLabelSv, relationLabelSv } from "@/components/inspector/utils/labels";
import { criticalValueContent, envLabelSv, envValueClass, slaValueClass, textOrDash, yesNo, yesNoValueClass } from "@/components/inspector/utils/format";

export type VerificationRenderArgs = {
  kind: "node";
  id: string;
  verifiedAt: any;
};

type Props = {
  selectedNode: GraphNode;
  schema: SchemaKindsResponse | null;
  nodes: GraphNode[];
  links: GraphLink[];
  nodeDetails: NodeDetailsResponse | null;
  nodeDetailsErr: string | null;
  nodeMeta: any;
  currentNodeClaim: NodeClaim | null;
  me: { username: string; role: string } | null;
  byId: Map<string, GraphNode>;
  onAddConnection: () => void;
  onOpenEdge: (edgeId: string) => void;
  renderVerificationValue: (args: VerificationRenderArgs) => React.ReactNode;
};

export function NodeInspectorBody({
  selectedNode,
  schema,
  nodes,
  links,
  nodeDetails,
  nodeDetailsErr,
  nodeMeta,
  currentNodeClaim,
  me,
  byId,
  onAddConnection,
  onOpenEdge,
  renderVerificationValue,
}: Props) {
  const rel = links.filter((e) => e.source === selectedNode.id || e.target === selectedNode.id);

  return (
    <>
      <div className="card-light">
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Översikt</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {metaTile("Typ", nodeKindLabelSv(selectedNode.kind, schema))}
          {metaTile("Backup-policy", textOrDash(nodeMeta.backup_policy))}
          <div style={{ gridColumn: "1 / -1" }}>{metaTile("Beskrivning av systemet", textOrDash(nodeMeta.description))}</div>
          {metaTile("Miljö", envLabelSv((nodeMeta as any).env), envValueClass((nodeMeta as any).env))}
          {metaTile("Kritisk", criticalValueContent((nodeMeta as any).critical), yesNoValueClass((nodeMeta as any).critical))}
          {metaTile("SLA", yesNo(nodeMeta.sla), slaValueClass((nodeMeta as any).sla))}
          {metaTile(
            "Verifierad av",
            renderVerificationValue({ kind: "node", id: selectedNode.id, verifiedAt: currentNodeClaim?.last_verified_at })
          )}
        </div>
      </div>

      <div className="card-light">
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Programvara</div>

        {nodeDetailsErr ? (
          <div style={{ color: "var(--danger-text)", fontSize: 13, fontWeight: 600 }}>{nodeDetailsErr}</div>
        ) : !nodeDetails ? (
          <div style={{ color: "var(--panel-muted)", fontSize: 13 }}>Laddar…</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {metaTile("Syfte", textOrDash(nodeDetails.software?.purpose))}
            <div style={{ gridColumn: "1 / -1" }}>{metaTile("Programbeskrivning", textOrDash(nodeDetails.software?.description))}</div>
          </div>
        )}
      </div>

      <div className="card-light">
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Leverantör & ägarskap</div>

        {nodeDetailsErr ? (
          <div style={{ color: "var(--danger-text)", fontSize: 13, fontWeight: 600 }}>{nodeDetailsErr}</div>
        ) : !nodeDetails ? (
          <div style={{ color: "var(--panel-muted)", fontSize: 13 }}>Laddar…</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {metaTile("Intern avdelning", deptLabelSv(nodeDetails.node.owning_department))}
            {metaTile(
              "Typ av leverantör",
              nodeDetails.supplier_types.length ? nodeDetails.supplier_types.map(supplierTypeLabelSv).join(", ") : "—"
            )}
            <div style={{ gridColumn: "1 / -1" }}>
              {metaTile("Leverantör", nodeDetails.suppliers.length ? nodeDetails.suppliers.map((s) => s.name).join(", ") : "—")}
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              {metaTile("Ägare", nodeDetails.owners.length ? nodeDetails.owners.map((o) => o.name).join(", ") : "—")}
            </div>
          </div>
        )}
      </div>

      <div className="card-light">
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Risk & klassning</div>

        {nodeDetailsErr ? (
          <div style={{ color: "var(--danger-text)", fontSize: 13, fontWeight: 600 }}>{nodeDetailsErr}</div>
        ) : !nodeDetails ? (
          <div style={{ color: "var(--panel-muted)", fontSize: 13 }}>Laddar…</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {metaTile("Legala krav", yesNo(nodeDetails.risk?.legal_requirements))}
            {metaTile("Finansiellt värde", yesNo(nodeDetails.risk?.financial_value))}
            {metaTile("PII", yesNo(nodeDetails.risk?.pii))}
            {metaTile("Verksamhetskritikalitet", businessCriticalityLabelSv(nodeDetails.risk?.business_criticality))}
            {metaTile("Informationsklass", informationClassLabelSv(nodeDetails.risk?.information_class))}
            {metaTile(
              "Affärskritikalitet",
              typeof nodeDetails.risk?.criticality_score === "number" ? String(nodeDetails.risk.criticality_score) : "—"
            )}
          </div>
        )}
      </div>

      <div className="card-light">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Relation och mål</div>
          <button type="button" onClick={onAddConnection} style={{ padding: "8px 10px" }}>
            Lägg till koppling
          </button>
        </div>

        <div style={{ height: 12 }} />

        {rel.length === 0 ? (
          <div style={{ color: "var(--panel-muted)", fontSize: 13 }}>Inga kopplingar.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rel.map((e) => {
              const otherId = e.source === selectedNode.id ? e.target : e.source;
              const other = byId.get(otherId);
              const otherName = other?.name ?? otherId;
              const hasReverse = rel.some((x) => x.source === otherId && x.target === selectedNode.id && x.kind === e.kind);
              const arrow = hasReverse ? "↔" : e.source === selectedNode.id ? "→" : "←";
              return (
                <button
                  key={e.id}
                  onClick={() => onOpenEdge(e.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 10px",
                    borderRadius: 14,
                    border: hasReverse
                      ? stripedBorder()
                      : e.source === selectedNode.id
                      ? "1px solid var(--info-border)"
                      : "1px solid var(--success-border)",
                    background: hasReverse
                      ? stripedBg()
                      : e.source === selectedNode.id
                      ? "var(--info-bg)"
                      : "var(--success-bg)",
                    color: "var(--panel-text)",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {arrow} {otherName}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400 }}>{relationLabelSv(e.kind)}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
