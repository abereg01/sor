import type { FlowDirection } from "@/api/types";
import type { EdgeClaim } from "@/api/edgeClaims";
import { directionLabelSv } from "./inspectorUtils";

export function EdgeFlowDirectionCard({
  dirDraft,
  dirDirty,
  setDirDraft,
  setDirDirty,
  onSave,
  savingDisabled,
}: {
  dirDraft: FlowDirection;
  dirDirty: boolean;
  setDirDraft: (v: FlowDirection) => void;
  setDirDirty: (v: boolean) => void;
  onSave: () => Promise<void>;
  savingDisabled: boolean;
  currentClaim?: EdgeClaim | null;
}) {
  return (
    <div className="card-light">
      <div style={{ marginTop: 2, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400 }}>Flödesriktning</div>
          <button onClick={onSave} disabled={savingDisabled} style={{ padding: "8px 10px" }}>
            Spara
          </button>
        </div>

        <select
          value={dirDraft}
          onChange={(e) => {
            setDirDraft(e.target.value as FlowDirection);
            setDirDirty(true);
          }}
        >
          <option value="source_to_target">{directionLabelSv("source_to_target")}</option>
          <option value="target_to_source">{directionLabelSv("target_to_source")}</option>
          <option value="bidirectional">{directionLabelSv("bidirectional")}</option>
        </select>
      </div>
    </div>
  );
}
