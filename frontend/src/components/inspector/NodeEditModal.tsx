import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import type { FlowDirection, GraphLink, GraphNode, SchemaKindsResponse } from "@/api/types";
import { patchEdgeMetadata } from "@/api/client";
import {
  BUSINESS_CRITICALITY_VALUES,
  INFORMATION_CLASS_VALUES,
  OWNING_DEPARTMENT_OPTIONS,
  SUPPLIER_TYPE_VALUES,
  businessCriticalityLabelSv,
  informationClassLabelSv,
  isValidBusinessCriticality,
  isValidInformationClass,
  isValidSupplierType,
  normalizeList,
  supplierTypeLabelSv,
  trimToNull,
  type BusinessCriticality,
  type InformationClass,
  type SupplierType,
} from "@/lib/nodeDetailsValidation";
import {
  getNodeDetailsWithEtag,
  lookupOwners,
  lookupSuppliers,
  putNodeDetails,
  type NodeDetailsResponse,
  type NodeRisk,
  type NodeSoftware,
  type PutNodeDetailsRequest,
} from "@/api/nodeDetails";
import { ComboChipsEditor } from "@/components/ui/ComboChipsEditor";

type Props = {
  open: boolean;

  mode: "node" | "edge";
  nodeId?: string | null;

  edge?: GraphLink | null;
  nodes?: GraphNode[];

  schema?: SchemaKindsResponse | null;

  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onError: (msg: string) => void;
};

type TriState = boolean | null;

type OverviewEnv = "prod" | "dev" | "test" | "stage" | "";

type OverviewDraft = {
  backup_policy: string;
  description: string;
  environment: OverviewEnv;
  critical: TriState;
  domain: string;
  sla: TriState;
};

const ENV_OPTIONS: Array<{ value: OverviewEnv; label: string }> = [
  { value: "", label: "—" },
  { value: "prod", label: "Produktion" },
  { value: "dev", label: "Utveckling" },
  { value: "test", label: "Test" },
  { value: "stage", label: "Stage" },
];

function overlayStyle() {
  return {
    position: "fixed" as const,
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    background: "var(--overlay-medium)",
    zIndex: 20000,
  };
}

function modalStyle() {
  return {
    width: "min(980px, calc(100vw - 32px))",
    maxHeight: "calc(100vh - 48px)",
    overflow: "auto" as const,
    background: "var(--panel-bg)",
    border: "1px solid var(--panel-border)",
    borderRadius: 18,
    boxShadow: "0 18px 70px var(--shadow-elev-2)",
    padding: 14,
  };
}

function sectionStyle(): React.CSSProperties {
  return {
    border: "1px solid var(--panel-border)",
    borderRadius: 14,
    padding: 12,
    background: "var(--panel-bg)",
  };
}

const BACKUP_POLICY_OPTIONS = ["Nattlig", "Veckovis", "Månadsvis", "Ingen"];
const BUSINESS_SCORE_OPTIONS = Array.from({ length: 10 }, (_, i) => String(i + 1));

function triFromYesNo(v: unknown): TriState {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "Ja") return true;
    if (s === "Nej") return false;
  }
  return null;
}

function triToYesNo(v: TriState): "" | "Ja" | "Nej" {
  if (v === null) return "";
  return v ? "Ja" : "Nej";
}

function metaGetString(meta: unknown, key: string): string {
  const m = (meta ?? {}) as Record<string, any>;
  const v = m[key];
  return typeof v === "string" ? v : "";
}

function metaGetEnv(meta: unknown): OverviewEnv {
  const raw = metaGetString(meta, "environment").trim().toLowerCase();
  if (raw === "prod" || raw === "dev" || raw === "test" || raw === "stage") return raw as OverviewEnv;
  return "";
}

function metaGetTri(meta: unknown, key: string): TriState {
  const m = (meta ?? {}) as Record<string, any>;
  const v = m[key];
  if (typeof v === "boolean") return v;
  return null;
}

function nodeName(nodes: GraphNode[] | undefined, id: string): string {
  const n = nodes?.find((x) => x.id === id);
  return n?.name ?? id;
}

function kindLabelSv(kind: string): string {
  if (!kind) return "—";
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function parseBusinessScore(v: string): { ok: boolean; value: number | null; error?: string } {
  const s = String(v ?? "").trim();
  if (!s) return { ok: true, value: null };
  const n = Number(s);
  if (!Number.isInteger(n)) return { ok: false, value: null, error: "Välj ett heltal mellan 1 och 10." };
  if (n < 1 || n > 10) return { ok: false, value: null, error: "Välj ett tal mellan 1 och 10." };
  return { ok: true, value: n };
}

export function NodeEditModal({ open, mode, nodeId, edge, nodes, onClose, onSaved, onError }: Props) {
  const [saving, setSaving] = useState(false);

  const [original, setOriginal] = useState<NodeDetailsResponse | null>(null);
  const [etag, setEtag] = useState<string | null>(null);

  const [overview, setOverview] = useState<OverviewDraft>({
    backup_policy: "",
    description: "",
    environment: "",
    critical: null,
    domain: "",
    sla: null,
  });

  const [draftDept, setDraftDept] = useState<string>("");
  const [draftSupplierTypes, setDraftSupplierTypes] = useState<string[]>([]);
  const [draftSuppliers, setDraftSuppliers] = useState<string[]>([]);
  const [draftOwners, setDraftOwners] = useState<string[]>([]);
  const [draftSoftware, setDraftSoftware] = useState<NodeSoftware>({
    software_name: null,
    purpose: null,
    description: null,
  });
  const [draftRisk, setDraftRisk] = useState<NodeRisk>({
    legal_requirements: null,
    financial_value: null,
    pii: null,
    business_criticality: null,
    information_class: null,
    criticality_score: null,
  });
  const [businessScoreText, setBusinessScoreText] = useState<string>("");

  const [edgeDirLoaded, setEdgeDirLoaded] = useState(false);
  const [edgeDir, setEdgeDir] = useState<FlowDirection>("source_to_target");
  const [edgeCritical, setEdgeCritical] = useState<TriState>(null);
  const [edgeSla, setEdgeSla] = useState<TriState>(null);
  const [edgeDomain, setEdgeDomain] = useState<string>("");
  const [edgeDescription, setEdgeDescription] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    if (mode !== "node") return;
    if (!nodeId) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await getNodeDetailsWithEtag(nodeId);
        if (cancelled) return;

        setOriginal(res.data);
        setEtag(res.etag);

        const meta = res.data.node.metadata;
        setOverview({
          backup_policy: metaGetString(meta, "backup_policy"),
          description: metaGetString(meta, "description"),
          environment: metaGetEnv(meta),
          critical: metaGetTri(meta, "critical"),
          domain: metaGetString(meta, "domain"),
          sla: metaGetTri(meta, "sla"),
        });

        setDraftDept(res.data.node.owning_department ?? "");
        setDraftSupplierTypes(res.data.supplier_types ?? []);
        setDraftSuppliers(res.data.suppliers.length ? [res.data.suppliers[0].name] : []);
        setDraftOwners(res.data.owners.length ? [res.data.owners[0].name] : []);
        setDraftSoftware(res.data.software ?? { software_name: null, purpose: null, description: null });

        const r =
          res.data.risk ?? ({
            legal_requirements: null,
            financial_value: null,
            pii: null,
            business_criticality: null,
            information_class: null,
            criticality_score: null,
          } as NodeRisk);

        setDraftRisk(r);
        setBusinessScoreText(r.criticality_score === null || r.criticality_score === undefined ? "" : String(r.criticality_score));
      } catch (e: any) {
        onError(e?.message ?? String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, mode, nodeId, onError]);

  useEffect(() => {
    if (!open) return;
    if (mode !== "edge") return;
    if (!edge) return;

    const flows = Array.isArray(edge.flows) ? edge.flows : [];
    const dir: FlowDirection = (flows[0]?.direction as FlowDirection | undefined) ?? "source_to_target";
    setEdgeDir(dir);
    setEdgeDirLoaded(true);

    const m = (edge.metadata ?? {}) as Record<string, any>;
    setEdgeCritical(typeof m.critical === "boolean" ? m.critical : null);
    setEdgeSla(typeof m.sla === "boolean" ? m.sla : null);
    setEdgeDomain(typeof m.domain === "string" ? m.domain : "");
    setEdgeDescription(typeof m.description === "string" ? m.description : "");
  }, [open, mode, edge]);

  const supplierTypeOptions = useMemo(
    () => SUPPLIER_TYPE_VALUES.map((v) => ({ value: v, label: supplierTypeLabelSv(v) })),
    []
  );

  const businessCriticalityOptions = useMemo(
    () => BUSINESS_CRITICALITY_VALUES.map((v) => ({ value: v, label: businessCriticalityLabelSv(v) })),
    []
  );

  const informationClassOptions = useMemo(
    () => INFORMATION_CLASS_VALUES.map((v) => ({ value: v, label: informationClassLabelSv(v) })),
    []
  );

  const businessScore = useMemo(() => parseBusinessScore(businessScoreText), [businessScoreText]);

  const canSaveNode = useMemo(() => {
    if (!original || !etag) return false;

    for (const t of draftSupplierTypes) {
      if (!isValidSupplierType(t)) return false;
    }

    if (draftRisk.business_criticality && !isValidBusinessCriticality(draftRisk.business_criticality)) return false;
    if (draftRisk.information_class && !isValidInformationClass(draftRisk.information_class)) return false;

    if (!businessScore.ok) return false;

    return true;
  }, [original, etag, draftSupplierTypes, draftRisk.business_criticality, draftRisk.information_class, businessScore.ok]);

  const canSaveEdge = useMemo(() => {
    if (!edge) return false;
    if (!edgeDirLoaded) return false;
    return true;
  }, [edge, edgeDirLoaded]);

  async function onSave() {
    if (saving) return;

    if (mode === "node") {
      if (!canSaveNode || !original || !etag) return;

      setSaving(true);
      try {
        const deptValue = trimToNull(draftDept);

        const supplierTypesValue: SupplierType[] = normalizeList(draftSupplierTypes)
          .map((x) => x.toLowerCase())
          .filter(isValidSupplierType) as SupplierType[];

        const suppliersValue = normalizeList(draftSuppliers).slice(0, 1);
        const ownersValue = normalizeList(draftOwners).slice(0, 1);

        const softwareValue = {
          software_name: trimToNull(draftSoftware.software_name),
          purpose: trimToNull(draftSoftware.purpose),
          description: trimToNull(draftSoftware.description),
        };

        const riskValue = {
          pii: draftRisk.pii,
          legal_requirements: draftRisk.legal_requirements,
          financial_value: draftRisk.financial_value,
          business_criticality: draftRisk.business_criticality ? String(draftRisk.business_criticality).trim().toLowerCase() : null,
          information_class: draftRisk.information_class ? String(draftRisk.information_class).trim().toLowerCase() : null,
          criticality_score: businessScore.ok ? businessScore.value : null,
        };

        const metadataPatch = {
          backup_policy: trimToNull(overview.backup_policy),
          description: trimToNull(overview.description),
          environment: overview.environment ? overview.environment : null,
          critical: overview.critical,
          domain: trimToNull(overview.domain),
          sla: overview.sla,
        };

        const req: PutNodeDetailsRequest = {
          metadata: metadataPatch,
          owning_department: deptValue,
          supplier_types: supplierTypesValue,
          suppliers: suppliersValue,
          owners: ownersValue,
          software: softwareValue,
          risk: riskValue,
        };

        const res = await putNodeDetails(original.node.id, req, { ifMatch: etag });
        setOriginal(res.data);
        setEtag(res.etag);

        await Promise.resolve(onSaved());
        try {
          window.dispatchEvent(new Event("reviews:changed"));
        } catch {
        }
        onClose();
      } catch (e: any) {
        onError(e?.message ?? String(e));
      } finally {
        setSaving(false);
      }

      return;
    }

    if (!canSaveEdge || !edge) return;

    setSaving(true);
    try {
      const m: Record<string, any> = {
        ...(edge.metadata ?? {}),
        critical: edgeCritical,
        sla: edgeSla,
        domain: trimToNull(edgeDomain),
        description: trimToNull(edgeDescription),
      };

      await patchEdgeMetadata(edge.id, edge.etag, m);

      await Promise.resolve(onSaved());
      try {
        window.dispatchEvent(new Event("reviews:changed"));
      } catch {
      }
      onClose();
    } catch (e: any) {
      onError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  const title = mode === "edge" ? "Redigera koppling" : "Redigera objekt";

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const content = (
    <div style={overlayStyle()} role="dialog" aria-modal="true" aria-label={title} onMouseDown={onClose}>
      <div className="panel-light" style={modalStyle()} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <div style={{ fontWeight: 950, fontSize: 16 }}>{title}</div>
            {mode === "edge" && edge ? (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--panel-text-2)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {nodeName(nodes, edge.source)} → {nodeName(nodes, edge.target)}
              </div>
            ) : null}
          </div>

          <button type="button" onClick={onClose} aria-label="Stäng" title="Stäng" style={{ padding: "8px 10px" }}>
            <X size={16} />
          </button>
        </div>

        {mode === "node" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={sectionStyle()}>
              <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 10 }}>Översikt</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 800 }}>Typ</span>
                  <input value={kindLabelSv(original?.node.kind ?? "")} disabled />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 800 }}>Backup-policy</span>
                  <select
                    value={overview.backup_policy}
                    onChange={(e) => setOverview((o) => ({ ...o, backup_policy: e.target.value }))}
                  >
                    <option value="">—</option>
                    {BACKUP_POLICY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>

                <div style={{ gridColumn: "1 / -1" }}>
                  <ComboChipsEditor
                    label="Ägare"
                    placeholder="Skriv för att lägga till…"
                    values={draftOwners}
                    lookup={(q) => lookupOwners(q)}
                    onChange={(next) => setDraftOwners(next)}
                    single
                  />
                </div>

                <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
                  <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 800 }}>Beskrivning av systemet</span>
                  <textarea rows={4} value={overview.description} onChange={(e) => setOverview((o) => ({ ...o, description: e.target.value }))} placeholder="—" />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 800 }}>Miljö</span>
                  <select value={overview.environment} onChange={(e) => setOverview((o) => ({ ...o, environment: e.target.value as OverviewEnv }))}>
                    {ENV_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 800 }}>Kritisk</span>
                  <select value={triToYesNo(overview.critical)} onChange={(e) => setOverview((o) => ({ ...o, critical: triFromYesNo(e.target.value) }))}>
                    <option value="">—</option>
                    <option value="Ja">Ja</option>
                    <option value="Nej">Nej</option>
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 800 }}>Domän</span>
                  <select value={overview.domain} onChange={(e) => setOverview((o) => ({ ...o, domain: e.target.value }))}>
                    <option value="">—</option>
                    <option value="KEAB">KEAB</option>
                    <option value="Process">Process</option>
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 800 }}>SLA</span>
                  <select value={triToYesNo(overview.sla)} onChange={(e) => setOverview((o) => ({ ...o, sla: triFromYesNo(e.target.value) }))}>
                    <option value="">—</option>
                    <option value="Ja">Ja</option>
                    <option value="Nej">Nej</option>
                  </select>
                </label>
              </div>
            </div>

            <div style={sectionStyle()}>
              <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 10 }}>Programvara</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 800 }}>Syfte</span>
                  <textarea
                    rows={4}
                    value={draftSoftware.purpose ?? ""}
                    onChange={(e) => setDraftSoftware((s) => ({ ...s, purpose: e.target.value }))}
                    placeholder="T.ex. Databas för …"
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 800 }}>Programbeskrivning</span>
                  <textarea rows={4} value={draftSoftware.description ?? ""} onChange={(e) => setDraftSoftware((s) => ({ ...s, description: e.target.value }))} />
                </label>
              </div>
            </div>

            <div style={sectionStyle()}>
              <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 10 }}>Leverantör & ägarskap</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 800 }}>Intern avdelning</span>
                  <select value={draftDept ?? ""} onChange={(e) => setDraftDept(e.target.value)}>
                    <option value="">—</option>
                    {OWNING_DEPARTMENT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 800 }}>Typ av leverantör</span>
                  <select
                    value={draftSupplierTypes[0] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDraftSupplierTypes(v ? [v] : []);
                    }}
                  >
                    <option value="">—</option>
                    {supplierTypeOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div style={{ gridColumn: "1 / -1" }}>
                  <ComboChipsEditor
                    label="Leverantör"
                    placeholder="Skriv för att lägga till…"
                    values={draftSuppliers}
                    lookup={(q) => lookupSuppliers(q)}
                    onChange={(next) => setDraftSuppliers(next)}
                    single
                  />
                </div>

              </div>
            </div>

            <div style={sectionStyle()}>
              <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 10 }}>Risk & klassning</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 800 }}>Legala krav</span>
                  <select value={triToYesNo(draftRisk.legal_requirements)} onChange={(e) => setDraftRisk((r) => ({ ...r, legal_requirements: triFromYesNo(e.target.value) }))}>
                    <option value="">—</option>
                    <option value="Ja">Ja</option>
                    <option value="Nej">Nej</option>
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 800 }}>Finansiellt värde</span>
                  <select value={triToYesNo(draftRisk.financial_value)} onChange={(e) => setDraftRisk((r) => ({ ...r, financial_value: triFromYesNo(e.target.value) }))}>
                    <option value="">—</option>
                    <option value="Ja">Ja</option>
                    <option value="Nej">Nej</option>
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 800 }}>PII</span>
                  <select value={triToYesNo(draftRisk.pii)} onChange={(e) => setDraftRisk((r) => ({ ...r, pii: triFromYesNo(e.target.value) }))}>
                    <option value="">—</option>
                    <option value="Ja">Ja</option>
                    <option value="Nej">Nej</option>
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 800 }}>Verksamhetskritikalitet</span>
                  <select
                    value={draftRisk.business_criticality ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return setDraftRisk((r) => ({ ...r, business_criticality: null }));
                      if (!isValidBusinessCriticality(v)) return;
                      setDraftRisk((r) => ({ ...r, business_criticality: v }));
                    }}
                  >
                    <option value="">—</option>
                    {businessCriticalityOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 800 }}>Informationsklass</span>
                  <select
                    value={draftRisk.information_class ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return setDraftRisk((r) => ({ ...r, information_class: null }));
                      if (!isValidInformationClass(v)) return;
                      setDraftRisk((r) => ({ ...r, information_class: v }));
                    }}
                  >
                    <option value="">—</option>
                    {informationClassOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 800 }}>Affärskritikalitet</span>
                  <select value={businessScoreText} onChange={(e) => setBusinessScoreText(e.target.value)}>
                    <option value="">—</option>
                    {BUSINESS_SCORE_OPTIONS.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  {!businessScore.ok ? <div style={{ marginTop: 6, color: "crimson", fontSize: 12, fontWeight: 800 }}>{businessScore.error}</div> : null}
                </label>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
              <button type="button" onClick={onClose} className="btn-danger">
                Avbryt
              </button>
              <button type="button" disabled={!canSaveNode} onClick={onSave} className="btn-success">
                {saving ? "Sparar…" : "Spara"}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={sectionStyle()}>
              <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 10 }}>Översikt</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 800 }}>Riktning</span>
                  <select value={edgeDir} onChange={(e) => setEdgeDir(e.target.value as FlowDirection)}>
                    <option value="source_to_target">Källa → Mål</option>
                    <option value="target_to_source">Mål → Källa</option>
                    <option value="bidirectional">Båda</option>
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 800 }}>Kritisk</span>
                  <select value={triToYesNo(edgeCritical)} onChange={(e) => setEdgeCritical(triFromYesNo(e.target.value))}>
                    <option value="">—</option>
                    <option value="Ja">Ja</option>
                    <option value="Nej">Nej</option>
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 800 }}>SLA</span>
                  <select value={triToYesNo(edgeSla)} onChange={(e) => setEdgeSla(triFromYesNo(e.target.value))}>
                    <option value="">—</option>
                    <option value="Ja">Ja</option>
                    <option value="Nej">Nej</option>
                  </select>
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 800 }}>Domän</span>
                  <input value={edgeDomain} onChange={(e) => setEdgeDomain(e.target.value)} placeholder="—" />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
                  <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 800 }}>Beskrivning</span>
                  <textarea rows={4} value={edgeDescription} onChange={(e) => setEdgeDescription(e.target.value)} placeholder="—" />
                </label>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
              <button type="button" onClick={onClose} className="btn-danger">
                Avbryt
              </button>
              <button type="button" disabled={!canSaveEdge} onClick={onSave} className="btn-success">
                {saving ? "Sparar…" : "Spara"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
