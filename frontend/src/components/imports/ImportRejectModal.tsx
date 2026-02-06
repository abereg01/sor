import React from "react";
import { t } from "@/i18n";
import { buttonStyle, miniMuted } from "./importStyles";
import { formatClaimSummary } from "./importUtils";
import { edgeLabelFromGraph } from "@/api/imports";

type Props = {
  proposal: any;
  nodesById: Map<string, string>;
  reason: string;
  saving: boolean;
  onReasonChange: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
};

export function ImportRejectModal({
  proposal,
  nodesById,
  reason,
  saving,
  onReasonChange,
  onConfirm,
  onClose,
}: Props) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "var(--overlay-strong)",
        backdropFilter: "blur(6px)",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(720px, 100%)",
          borderRadius: 18,
          border: "1px solid var(--border-strong)",
          background: "var(--bg-app)",
          padding: 14,
        }}
      >
        <div style={{ fontWeight: 1000, fontSize: 14 }}>
          {t("imports.rejectTitle")}
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <div style={miniMuted()}>{t("imports.rejectHelp")}</div>

          <div style={{ padding: 10, borderRadius: 12, background: "var(--surface)" }}>
            <div style={{ fontWeight: 900 }}>
              {edgeLabelFromGraph(nodesById, proposal.edge)}
            </div>
            <div style={{ marginTop: 6, fontSize: 12 }}>
              {formatClaimSummary(nodesById, proposal.claim.claim, proposal.claim.flows)}
            </div>
          </div>

          <textarea
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            rows={4}
            placeholder="Valfritt. Ex: Dublett, fel riktning…"
          />

          <div style={{ display: "flex", gap: 10 }}>
            <button style={buttonStyle("danger")} onClick={onConfirm} disabled={saving}>
              {saving ? t("common.saving") : t("imports.rejectConfirm")}
            </button>
            <button style={buttonStyle("ghost")} onClick={onClose} disabled={saving}>
              {t("imports.cancel")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
