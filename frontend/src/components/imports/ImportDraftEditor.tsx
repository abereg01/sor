import React from "react";
import type {
  ProposalEdgeInput,
  NewEdgeClaimFlow,
  NewEdgeClaimEvidence,
} from "@/api/imports";
import type { GraphNode } from "@/api/types";
import { t } from "@/i18n";
import { cardStyle, buttonStyle, miniMuted } from "./importStyles";
import { edgeLabelFromGraph } from "@/api/imports";

type Props = {
  nodes: GraphNode[];
  nodesById: Map<string, string>;
  edgeKinds: string[];
  dataCategories: GraphNode[];

  draft: ProposalEdgeInput;
  draftEdges: ProposalEdgeInput[];

  onDraftChange: (d: ProposalEdgeInput) => void;
  onAddDraft: () => void;
  onRemoveDraft: (idx: number) => void;
  onSubmitDrafts: () => void;

  onAddFlow: () => void;
  onUpdateFlow: (i: number, p: Partial<NewEdgeClaimFlow>) => void;
  onRemoveFlow: (i: number) => void;

  onAddEvidence: () => void;
  onUpdateEvidence: (i: number, p: Partial<NewEdgeClaimEvidence>) => void;
  onRemoveEvidence: (i: number) => void;

  createdBatchId: string;
};

export function ImportDraftEditor(props: Props) {
  const {
    nodes,
    nodesById,
    edgeKinds,
    dataCategories,
    draft,
    draftEdges,
    onDraftChange,
    onAddDraft,
    onRemoveDraft,
    onSubmitDrafts,
    onAddFlow,
    onUpdateFlow,
    onRemoveFlow,
    onAddEvidence,
    onUpdateEvidence,
    onRemoveEvidence,
    createdBatchId,
  } = props;

  return (
    <div style={cardStyle()}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontWeight: 600 }}>{t("imports.addProposal")}</div>
        <div style={{ marginLeft: "auto", ...miniMuted() }}>
          {draftEdges.length} i kö
        </div>
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <select
            value={draft.from_id}
            onChange={(e) => onDraftChange({ ...draft, from_id: e.target.value })}
          >
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name} ({n.kind})
              </option>
            ))}
          </select>

          <select
            value={draft.to_id}
            onChange={(e) => onDraftChange({ ...draft, to_id: e.target.value })}
          >
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name} ({n.kind})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <select
            value={draft.kind}
            onChange={(e) => onDraftChange({ ...draft, kind: e.target.value })}
          >
            {edgeKinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>

          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={String(draft.confidence ?? 0.6)}
            onChange={(e) =>
              onDraftChange({ ...draft, confidence: Number(e.target.value) })
            }
          />

          <input
            value={draft.source}
            onChange={(e) => onDraftChange({ ...draft, source: e.target.value })}
          />
        </div>

        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 600 }}>{t("imports.flows")}</div>
            <div style={{ marginLeft: "auto" }}>
              <button style={buttonStyle("ghost")} onClick={onAddFlow}>
                {t("imports.addFlow")}
              </button>
            </div>
          </div>

          {(draft.flows ?? []).map((f, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 80px",
                gap: 10,
                marginTop: 8,
              }}
            >
              <input
                value={f.flow_type}
                onChange={(e) => onUpdateFlow(i, { flow_type: e.target.value })}
              />

              <select
                value={f.data_category_id ?? ""}
                onChange={(e) =>
                  onUpdateFlow(i, {
                    data_category_id: e.target.value || null,
                  })
                }
              >
                <option value="">{t("imports.none")}</option>
                {dataCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <input
                value={f.frequency ?? ""}
                onChange={(e) =>
                  onUpdateFlow(i, { frequency: e.target.value || null })
                }
              />

              <button
                style={buttonStyle("danger")}
                onClick={() => onRemoveFlow(i)}
              >
                {t("imports.remove")}
              </button>
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 600 }}>{t("imports.evidence")}</div>
            <div style={{ marginLeft: "auto" }}>
              <button style={buttonStyle("ghost")} onClick={onAddEvidence}>
                {t("imports.addEvidence")}
              </button>
            </div>
          </div>

          {(draft.evidence ?? []).map((ev, i) => (
            <div
              key={i}
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px", gap: 10, marginTop: 8 }}
            >
              <input
                value={ev.evidence_type}
                onChange={(e) =>
                  onUpdateEvidence(i, { evidence_type: e.target.value })
                }
              />

              <input
                value={ev.reference}
                onChange={(e) =>
                  onUpdateEvidence(i, { reference: e.target.value })
                }
              />

              <button
                style={buttonStyle("danger")}
                onClick={() => onRemoveEvidence(i)}
              >
                {t("imports.remove")}
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button style={buttonStyle("primary")} onClick={onAddDraft}>
            {t("imports.queueProposal")}
          </button>

          <button style={buttonStyle("primary")} onClick={onSubmitDrafts}>
            {t("imports.submitProposals")}
          </button>

          <div style={{ marginLeft: "auto", ...miniMuted() }}>
            {createdBatchId
              ? `Batch: ${createdBatchId.slice(0, 8)}…`
              : "Ingen batch än"}
          </div>
        </div>

        {draftEdges.length > 0 && (
          <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 600 }}>{t("imports.queued")}</div>

            {draftEdges.map((e, idx) => (
              <div
                key={idx}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  background: "var(--surface)",
                  display: "flex",
                  gap: 10,
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {edgeLabelFromGraph(nodesById, e as any)}
                </div>

                <div style={{ marginLeft: "auto" }}>
                  <button
                    style={buttonStyle("danger")}
                    onClick={() => onRemoveDraft(idx)}
                  >
                    {t("imports.remove")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
