import React from "react";
import type { GraphLink, GraphNode } from "@/api/types";
import type { EdgeClaim } from "@/api/edgeClaims";

import { metaTile } from "@/components/inspector/parts/MetaTile";
import { directionBadge } from "@/components/inspector/parts/Badges";
import { directionLabelSv, relationLabelSv } from "@/components/inspector/utils/labels";
import { criticalValueContent, textOrDash, yesNo, yesNoValueClass } from "@/components/inspector/utils/format";
import { nodeName } from "@/components/inspector/utils/nodes";

type Me = { username: string; role: string } | null;

export type EdgeInspectorBodyProps = {
  selectedEdge: any;
  nodes: GraphNode[];
  links: GraphLink[];

  edgeMeta: any;
  dirDraft: any;

  currentClaim: EdgeClaim | null;
  me: Me;
  forceRerender: React.Dispatch<React.SetStateAction<number>>;

  slaValueClass: (v: any) => string | undefined;
  verificationValue: (args: any) => React.ReactNode;
};

export function EdgeInspectorBody(props: EdgeInspectorBodyProps) {
  const { selectedEdge, nodes, edgeMeta, dirDraft, currentClaim, me, forceRerender, slaValueClass, verificationValue } = props;

  return (
        <div className="card-light">
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Översikt</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {metaTile("Relation", relationLabelSv(selectedEdge.kind))}
            {metaTile(
              "Riktning",
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {directionBadge(dirDraft)}
                <span>{directionLabelSv(dirDraft)}</span>
              </div>
            )}
            {metaTile("Från", nodeName(nodes, selectedEdge.source))}
            {metaTile("Till", nodeName(nodes, selectedEdge.target))}
            {metaTile("Kritisk", criticalValueContent((edgeMeta as any).critical), yesNoValueClass((edgeMeta as any).critical))}
            {metaTile("SLA", yesNo(edgeMeta.sla), slaValueClass((edgeMeta as any).sla))}
            {metaTile(
              "Verifierad av",
              verificationValue({ kind: "edge", id: selectedEdge.id, verifiedAt: currentClaim?.last_verified_at, me, onVerified: () => forceRerender((x) => x + 1) })
            )}
            <div style={{ gridColumn: "1 / -1" }}>{metaTile("Beskrivning", textOrDash(edgeMeta.description))}</div>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "var(--panel-muted)", fontWeight: 400 }}>
            Redigering sker via Redigera-knappen ovan.
          </div>
        </div>
  );
}
