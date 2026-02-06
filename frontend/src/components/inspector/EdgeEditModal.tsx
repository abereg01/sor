import { useEffect, useMemo, useState } from "react";

import type { FlowDirection, GraphLink } from "@/api/types";
import type { EdgeClaim } from "@/api/edgeClaims";

type YesNo = "Ja" | "Nej" | "";

function yesNoFromAny(v: any): YesNo {
  if (typeof v === "boolean") return v ? "Ja" : "Nej";
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "Ja" || s === "Nej" || s === "") return s as YesNo;
    if (s.toLowerCase() === "true") return "Ja";
    if (s.toLowerCase() === "false") return "Nej";
  }
  return "";
}

function directionLabelSv(d: FlowDirection) {
  if (d === "source_to_target") return "Källa → Mål";
  if (d === "target_to_source") return "Mål → Källa";
  if (d === "bidirectional") return "Dubbelriktad";
  return d;
}

function relationLabelSv(kind: string) {
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

export function EdgeEditModal({
  open,
  edge,
  nodeName,
  direction,
  currentClaim,
  initialMeta,
  onClose,
  onError,
  onSaved,
  onSaveDirection,
  onSavePatch,
}: {
  open: boolean;
  edge: GraphLink | null;
  nodeName: (id: string) => string;
  direction: FlowDirection;
  currentClaim: EdgeClaim | null;
  initialMeta: Record<string, any>;
  onClose: () => void;
  onError: (msg: string) => void;
  onSaved: () => void | Promise<void>;
  onSaveDirection: (edgeId: string, claim: EdgeClaim | null, dir: FlowDirection) => Promise<void>;
  onSavePatch: (edgeId: string, etag: string, patch: Record<string, any>) => Promise<void>;
}) {
  const etag = (edge as any)?.etag as string | undefined;

  const initial = useMemo(() => {
    return {
      dir: direction,
      critical: yesNoFromAny((initialMeta as any)?.critical),
      sla: yesNoFromAny((initialMeta as any)?.sla),
      domain: typeof (initialMeta as any)?.domain === "string" ? (initialMeta as any).domain : "",
      description: typeof (initialMeta as any)?.description === "string" ? (initialMeta as any).description : "",
    };
  }, [edge?.id, etag, direction]);

  const [dir, setDir] = useState<FlowDirection>(initial.dir);
  const [critical, setCritical] = useState<YesNo>(initial.critical);
  const [sla, setSla] = useState<YesNo>(initial.sla);
  const [domain, setDomain] = useState<string>(initial.domain);
  const [description, setDescription] = useState<string>(initial.description);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDir(initial.dir);
    setCritical(initial.critical);
    setSla(initial.sla);
    setDomain(initial.domain);
    setDescription(initial.description);
    setSaving(false);
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !edge) return null;

  const dirty =
    dir !== initial.dir ||
    critical !== initial.critical ||
    sla !== initial.sla ||
    domain !== initial.domain ||
    description !== initial.description;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "var(--overlay-strong)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 14,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="panel-light"
        style={{
          width: "min(760px, 100%)",
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid var(--panel-border)",
          background: "var(--panel-bg)",
        }}
      >
        <div style={{ padding: "14px 14px 0 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Redigera koppling</div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              disabled={saving || !dirty || !etag}
              onClick={async () => {
                if (!edge || !etag) return;
                try {
                  setSaving(true);

                  const patch: Record<string, any> = {};
                  if (critical !== "") patch.critical = critical === "Ja";
                  if (sla !== "") patch.sla = sla === "Ja";
                  if (domain.trim() !== "") patch.domain = domain.trim();
                  if (description.trim() !== "") patch.description = description.trim();

                  await Promise.all([
                    dir !== initial.dir ? onSaveDirection(edge.id, currentClaim, dir) : Promise.resolve(),
                    Object.keys(patch).length > 0 ? onSavePatch(edge.id, etag, patch) : Promise.resolve(),
                  ]);

                  await Promise.resolve(onSaved());
                } catch (e: any) {
                  setSaving(false);
                  onError(e?.message ?? String(e));
                }
              }}
              style={{ padding: "9px 10px" }}
            >
              Spara
            </button>

            <button disabled={saving} onClick={onClose} style={{ padding: "9px 10px" }}>
              Avbryt
            </button>
          </div>
        </div>

        <div style={{ padding: "14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 650 }}>Relation</div>
              <div style={{ fontWeight: 600 }}>{relationLabelSv(edge.kind)}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 650 }}>Flödesriktning</div>
              <select value={dir} onChange={(e) => setDir(e.target.value as FlowDirection)}>
                <option value="source_to_target">{directionLabelSv("source_to_target")}</option>
                <option value="target_to_source">{directionLabelSv("target_to_source")}</option>
                <option value="bidirectional">{directionLabelSv("bidirectional")}</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 650 }}>Från</div>
              <div style={{ fontWeight: 600 }}>{nodeName(edge.source)}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 650 }}>Till</div>
              <div style={{ fontWeight: 600 }}>{nodeName(edge.target)}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 650 }}>Kritisk</div>
              <select value={critical} onChange={(e) => setCritical(e.target.value as YesNo)}>
                <option value="">—</option>
                <option value="Ja">Ja</option>
                <option value="Nej">Nej</option>
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 650 }}>SLA</div>
              <select value={sla} onChange={(e) => setSla(e.target.value as YesNo)}>
                <option value="">—</option>
                <option value="Ja">Ja</option>
                <option value="Nej">Nej</option>
              </select>
            </div>

            <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 650 }}>Domän</div>
              <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="KEAB / Process / ..." />
            </div>

            <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 650 }}>Beskrivning</div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Beskriv kopplingen"
                rows={5}
                style={{ resize: "vertical" }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
