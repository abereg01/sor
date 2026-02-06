import React from "react";
import { t } from "@/i18n";
import { cardStyle, buttonStyle, miniMuted } from "./importStyles";

type Props = {
  source: string;
  note: string;
  createdBatchId: string;
  onSourceChange: (v: string) => void;
  onNoteChange: (v: string) => void;
  onCreateBatch: () => void;
};

export function ImportNewBatch({
  source,
  note,
  createdBatchId,
  onSourceChange,
  onNoteChange,
  onCreateBatch,
}: Props) {
  return (
    <div style={cardStyle()}>
      <div style={{ fontWeight: 900 }}>{t("imports.createBatch")}</div>

      <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <div style={miniMuted()}>{t("imports.source")}</div>
          <select value={source} onChange={(e) => onSourceChange(e.target.value)}>
            <option value="excel">excel</option>
            <option value="manual">manual</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <div style={miniMuted()}>{t("imports.note")}</div>
          <input
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="t.ex. 'Q1 inventering'"
          />
        </label>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button style={buttonStyle("primary")} onClick={onCreateBatch}>
            {t("imports.createBatchButton")}
          </button>

          {createdBatchId ? (
            <div style={miniMuted()}>
              {t("imports.createdBatch")} <code>{createdBatchId}</code>
            </div>
          ) : (
            <div style={miniMuted()}>{t("imports.createdBatchHelp")}</div>
          )}
        </div>
      </div>
    </div>
  );
}
