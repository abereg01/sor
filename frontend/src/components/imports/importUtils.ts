import type { ProposalItem } from "@/api/imports";

export function formatClaimSummary(
  nodesById: Map<string, string>,
  claim: any | null | undefined,
  flows: any[] | null | undefined
): string {
  if (!claim) return "—";
  const src = claim.source ? `source=${String(claim.source)}` : "source=—";
  const conf = claim.confidence == null ? "confidence=—" : `confidence=${String(claim.confidence)}`;
  const status = claim.status ? `status=${String(claim.status)}` : "status=—";

  const flowStr =
    flows && flows.length
      ? flows
          .map((f) => {
            const cat = f.data_category_id
              ? nodesById.get(String(f.data_category_id)) ?? String(f.data_category_id).slice(0, 8)
              : "—";
            const prot = f.protocol ?? "—";
            const freq = f.frequency ?? "—";
            return `${f.flow_type} / ${cat} / ${prot} / ${freq}`;
          })
          .join(" · ")
      : "implicit";

  return `${status} · ${src} · ${conf} · flows=${flowStr}`;
}

export function compareTone(
  currentByEdgeId: Map<string, any>,
  edgeId: string,
  proposal: ProposalItem
): "ok" | "warn" | "muted" {
  const cur = currentByEdgeId.get(edgeId);
  if (!cur?.claim) return "warn";

  const p = proposal.claim.claim;
  const c = cur.claim;

  const sameSource = String(p.source ?? "") === String(c.source ?? "");
  const pc = p.confidence == null ? null : Number(p.confidence);
  const cc = c.confidence == null ? null : Number(c.confidence);
  const closeConf = pc != null && cc != null ? Math.abs(pc - cc) < 0.15 : false;

  if (sameSource && closeConf) return "ok";
  return "warn";
}
