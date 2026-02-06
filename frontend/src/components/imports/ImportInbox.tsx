import type { GraphLink, GraphNode } from "@/api/types";
import type { ImportBatchSummary, ProposalItem } from "@/api/imports";
import { edgeLabelFromGraph } from "@/api/imports";
import { t } from "@/i18n";
import { cardStyle, buttonStyle, miniMuted, pill } from "./importStyles";
import { formatClaimSummary, compareTone } from "./importUtils";

type Props = {
  nodes: GraphNode[];
  links: GraphLink[];
  nodesById: Map<string, string>;
  batches: ImportBatchSummary[];
  proposals: ProposalItem[];
  selectedBatchId: string;
  loadingInbox: boolean;
  onSelectBatch: (id: string) => void;
  onRefreshBatches: () => void;
  onRefreshProposals: () => void;
  onApprove: (p: ProposalItem) => void;
  onReject: (p: ProposalItem) => void;
  currentByEdgeId: Map<string, any>;
};

export function ImportInbox(props: Props) {
  const {
    nodes,
    batches,
    proposals,
    selectedBatchId,
    loadingInbox,
    onSelectBatch,
    onRefreshBatches,
    onRefreshProposals,
    onApprove,
    onReject,
    currentByEdgeId,
    nodesById,
  } = props;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={cardStyle()}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ fontWeight: 900 }}>{t("imports.batches")}</div>
          <div style={miniMuted()}>{loadingInbox ? "Laddar…" : `${batches.length} st`}</div>
          <div style={{ marginLeft: "auto" }}>
            <button style={buttonStyle("ghost")} onClick={onRefreshBatches}>
              {t("imports.reloadBatches")}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
          {batches.map((b) => {
            const active = b.id === selectedBatchId;
            return (
              <div
                key={b.id}
                onClick={() => onSelectBatch(b.id)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: active ? "1px solid var(--focus-border)" : "1px solid var(--border-subtle)",
                  background: active ? "var(--info-bg)" : "var(--surface)",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ fontWeight: 900 }}>{b.source}</div>
                  <div style={miniMuted()}>{b.open_proposals} öppna</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={cardStyle()}>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>{t("imports.proposals")}</div>
          <div style={{ marginLeft: "auto" }}>
            <button style={buttonStyle("ghost")} onClick={onRefreshProposals}>
              {t("imports.reloadProposals")}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
          {proposals.map((p) => {
            const edgeId = String(p.edge.id);
            const tone = compareTone(currentByEdgeId, edgeId, p);

            return (
              <div key={p.claim.claim.id} style={{ padding: 12, borderRadius: 14, background: "var(--surface)" }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ fontWeight: 900 }}>
                    {edgeLabelFromGraph(nodesById, p.edge)}
                  </div>
                  <div style={{ marginLeft: "auto" }}>
                    <span style={pill("", tone)}>
                      {tone === "ok" ? "≈" : "!"}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: 6, fontSize: 12 }}>
                  {formatClaimSummary(nodesById, p.claim.claim, p.claim.flows)}
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button style={buttonStyle("primary")} onClick={() => onApprove(p)}>
                    {t("imports.approve")}
                  </button>
                  <button style={buttonStyle("danger")} onClick={() => onReject(p)}>
                    {t("imports.reject")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
