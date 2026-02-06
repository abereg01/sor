import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { X } from "lucide-react";

import { createNode } from "@/api/nodes";
import {
  getNodeDetailsWithEtag,
  lookupOwners,
  lookupSuppliers,
  putNodeDetails,
  type PutNodeDetailsRequest,
  type NodeRisk,
  type NodeSoftware,
} from "@/api/nodeDetails";
import { ComboChipsEditor } from "@/components/ui/ComboChipsEditor";
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

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
  onError: (msg: string) => void;
  onRefresh: () => Promise<void>;
};

const NODE_KINDS: Array<{ value: string; label: string }> = [
  { value: "system", label: "System" },
  { value: "service", label: "Tjänst" },
  { value: "database", label: "Databas" },
  { value: "host", label: "Host" },
  { value: "vendor", label: "Leverantör" },
  { value: "team", label: "Team" },
  { value: "data_category", label: "Datakategori" },
  { value: "app", label: "App" },
  { value: "container", label: "Container" },
  { value: "external_dependency", label: "Extern beroende" },
];

const SUPPLIER_TYPE_OPTIONS: Array<{ value: SupplierType; label: string }> = SUPPLIER_TYPE_VALUES.map((v) => ({
  value: v,
  label: supplierTypeLabelSv(v),
}));

const BUSINESS_CRIT_OPTIONS: Array<{ value: BusinessCriticality; label: string }> = BUSINESS_CRITICALITY_VALUES.map((v) => ({
  value: v,
  label: businessCriticalityLabelSv(v),
}));

const INFO_CLASS_OPTIONS: Array<{ value: InformationClass; label: string }> = INFORMATION_CLASS_VALUES.map((v) => ({
  value: v,
  label: informationClassLabelSv(v),
}));

type TriState = boolean | null;

type OverviewEnv = "" | "dev" | "test" | "stage" | "prod";

const ENV_OPTIONS: Array<{ value: OverviewEnv; label: string }> = [
  { value: "", label: "—" },
  { value: "dev", label: "Dev" },
  { value: "test", label: "Test" },
  { value: "stage", label: "Stage" },
  { value: "prod", label: "Prod" },
];

function overlayStyle(open: boolean) {
  return {
    position: "fixed" as const,
    inset: 0,
    display: open ? "flex" : "none",
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

function sectionStyle(): CSSProperties {
  return {
    border: "1px solid var(--panel-border)",
    borderRadius: 14,
    padding: 12,
    background: "var(--panel-bg)",
  };
}

const BACKUP_POLICY_OPTIONS = ["Nattlig", "Veckovis", "Månadsvis", "Ingen"];
const BUSINESS_SCORE_OPTIONS = Array.from({ length: 10 }, (_, i) => String(i + 1));

function hasText(v: unknown) {
  return typeof v === "string" && v.trim().length > 0;
}

function triToYesNo(v: TriState): "" | "Ja" | "Nej" {
  if (v === null || v === undefined) return "";
  return v ? "Ja" : "Nej";
}

function triFromYesNo(v: any): TriState {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (s === "Ja") return true;
    if (s === "Nej") return false;
  }
  return null;
}

function parseBusinessScore(v: string): { ok: boolean; value: number | null; error?: string } {
  const s = String(v ?? "").trim();
  if (!s) return { ok: true, value: null };
  const n = Number(s);
  if (!Number.isInteger(n)) return { ok: false, value: null, error: "Välj ett heltal mellan 1 och 10." };
  if (n < 1 || n > 10) return { ok: false, value: null, error: "Välj ett tal mellan 1 och 10." };
  return { ok: true, value: n };
}

export function CreateNodeModal({ open, onClose, onCreated, onError, onRefresh }: Props) {
  const [creating, setCreating] = useState(false);

  const [kind, setKind] = useState<string>("system");
  const [name, setName] = useState<string>("");

  const [overview, setOverview] = useState<{
    backup_policy: string;
    description: string;
    environment: OverviewEnv;
    critical: TriState;
    domain: string;
    sla: TriState;
  }>({
    backup_policy: "",
    description: "",
    environment: "",
    critical: null,
    domain: "",
    sla: null,
  });

  const [draftDept, setDraftDept] = useState<string>("");
  const [draftSupplierTypes, setDraftSupplierTypes] = useState<SupplierType[]>([]);
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

  const [draftBusinessScoreText, setDraftBusinessScoreText] = useState<string>("");

  useEffect(() => {
    if (!open) return;

    setCreating(false);
    setKind("system");
    setName("");

    setOverview({
      backup_policy: "",
      description: "",
      environment: "",
      critical: null,
      domain: "",
      sla: null,
    });

    setDraftDept("");
    setDraftSupplierTypes([]);
    setDraftSuppliers([]);
    setDraftOwners([]);

    setDraftSoftware({ software_name: null, purpose: null, description: null });
    setDraftRisk({
      legal_requirements: null,
      financial_value: null,
      pii: null,
      business_criticality: null,
      information_class: null,
      criticality_score: null,
    });

    setDraftBusinessScoreText("");
  }, [open]);

  const nameOk = hasText(name);
  const kindOk = hasText(kind);

  const businessScore = useMemo(() => parseBusinessScore(draftBusinessScoreText), [draftBusinessScoreText]);
  const riskOk = businessScore.ok;

  const canCreate = nameOk && kindOk && riskOk && !creating;

  const deptValue = useMemo(() => {
    const v = trimToNull(draftDept);
    if (!v) return null;
    return v.trim().toLowerCase();
  }, [draftDept]);

  const supplierTypesValue = useMemo(() => {
    return (draftSupplierTypes ?? [])
      .map((s) => String(s).trim().toLowerCase())
      .filter((s) => isValidSupplierType(s)) as SupplierType[];
  }, [draftSupplierTypes]);

  const suppliersValue = useMemo(() => normalizeList(draftSuppliers).slice(0, 1), [draftSuppliers]);
  const ownersValue = useMemo(() => normalizeList(draftOwners).slice(0, 1), [draftOwners]);

  const softwareValue = useMemo(() => {
    const purpose = trimToNull(draftSoftware.purpose);
    const description = trimToNull(draftSoftware.description);
    if (!purpose && !description) return null;
    return { software_name: null, purpose, description };
  }, [draftSoftware]);

  const riskValue = useMemo(() => {
    const legal_requirements = triFromYesNo(draftRisk.legal_requirements);
    const financial_value = triFromYesNo(draftRisk.financial_value);
    const pii = triFromYesNo(draftRisk.pii);

    const business_criticality = isValidBusinessCriticality(draftRisk.business_criticality)
      ? (String(draftRisk.business_criticality).trim().toLowerCase() as BusinessCriticality)
      : null;

    const information_class = isValidInformationClass(draftRisk.information_class)
      ? (String(draftRisk.information_class).trim().toLowerCase() as InformationClass)
      : null;

    const criticality_score = businessScore.ok ? businessScore.value : null;

    const anySet =
      legal_requirements !== null ||
      financial_value !== null ||
      pii !== null ||
      business_criticality !== null ||
      information_class !== null ||
      criticality_score !== null;

    if (!anySet) return null;

    return {
      legal_requirements,
      financial_value,
      pii,
      business_criticality,
      information_class,
      criticality_score,
    };
  }, [draftRisk, businessScore]);

  async function onCreate() {
    if (!canCreate) return;

    setCreating(true);
    try {
      const created = await createNode({ kind: String(kind).trim(), name: String(name).trim() });

      const { etag } = await getNodeDetailsWithEtag(created.id);
      if (!etag) throw new Error("Saknar ETag från /nodes/:id/details (optimistic locking krävs)");

      const req: PutNodeDetailsRequest = {
        metadata: {
          backup_policy: trimToNull(overview.backup_policy),
          description: trimToNull(overview.description),
          environment: overview.environment ? overview.environment : null,
          critical: overview.critical,
          domain: trimToNull(overview.domain),
          sla: overview.sla,
        },
        owning_department: deptValue,
        supplier_types: supplierTypesValue,
        suppliers: suppliersValue,
        owners: ownersValue,
      };

      if (softwareValue) req.software = softwareValue;
      if (riskValue) req.risk = riskValue;

      await putNodeDetails(created.id, req, { ifMatch: etag });

      await onRefresh();
      onCreated(created.id);
      onClose();
    } catch (e: any) {
      onError(e?.message ?? String(e));
    } finally {
      setCreating(false);
    }
  }

  if (!open) return null;

  return (
    <div style={overlayStyle(open)} role="dialog" aria-modal="true" aria-label="Skapa nod">
      <div className="panel-light" style={modalStyle()} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontWeight: 600, fontSize: 16 }}>Skapa nod</div>
          </div>

          <button type="button" onClick={onClose} aria-label="Stäng" title="Stäng" style={{ padding: "8px 10px" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={sectionStyle()}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Översikt</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 600 }}>Typ</span>
                <select value={kind} onChange={(e) => setKind(e.target.value)}>
                  {NODE_KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 600 }}>Systemets namn</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="T.ex. Mobigo" />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 600 }}>Backup-policy</span>
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
                  onChange={(items) => setDraftOwners(items)}
                  single
                />
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 600 }}>Miljö</span>
                <select value={overview.environment} onChange={(e) => setOverview((o) => ({ ...o, environment: e.target.value as OverviewEnv }))}>
                  {ENV_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 600 }}>Kritisk</span>
                <select value={triToYesNo(overview.critical)} onChange={(e) => setOverview((o) => ({ ...o, critical: triFromYesNo(e.target.value) }))}>
                  <option value="">—</option>
                  <option value="Ja">Ja</option>
                  <option value="Nej">Nej</option>
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 600 }}>Domän</span>
                <select value={overview.domain} onChange={(e) => setOverview((o) => ({ ...o, domain: e.target.value }))}>
                  <option value="">—</option>
                  <option value="KEAB">KEAB</option>
                  <option value="Process">Process</option>
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 600 }}>SLA</span>
                <select value={triToYesNo(overview.sla)} onChange={(e) => setOverview((o) => ({ ...o, sla: triFromYesNo(e.target.value) }))}>
                  <option value="">—</option>
                  <option value="Ja">Ja</option>
                  <option value="Nej">Nej</option>
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, gridColumn: "1 / -1" }}>
                <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 600 }}>Beskrivning av systemet</span>
                <textarea rows={4} value={overview.description} onChange={(e) => setOverview((o) => ({ ...o, description: e.target.value }))} placeholder="—" />
              </label>
            </div>
          </div>

          <div style={sectionStyle()}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Programvara</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 600 }}>Syfte</span>
                <textarea
                  rows={4}
                  value={draftSoftware.purpose ?? ""}
                  onChange={(e) => setDraftSoftware((s) => ({ ...s, purpose: e.target.value }))}
                  placeholder="T.ex. Databas för …"
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 600 }}>Programbeskrivning</span>
                <textarea
                  rows={4}
                  value={draftSoftware.description ?? ""}
                  onChange={(e) => setDraftSoftware((s) => ({ ...s, description: e.target.value }))}
                />
              </label>
            </div>
          </div>

          <div style={sectionStyle()}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Leverantör & ägarskap</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 600 }}>Intern avdelning</span>
                <select value={draftDept} onChange={(e) => setDraftDept(e.target.value)}>
                  <option value="">—</option>
                  {OWNING_DEPARTMENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 600 }}>Typ av leverantör</span>
                <select
                  value={draftSupplierTypes[0] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value as SupplierType;
                    setDraftSupplierTypes(v ? [v] : []);
                  }}
                >
                  <option value="">—</option>
                  {SUPPLIER_TYPE_OPTIONS.map((o) => (
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
                  onChange={(items) => setDraftSuppliers(items)}
                  single
                />
              </div>
            </div>
          </div>

          <div style={sectionStyle()}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Risk & klassning</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 600 }}>PII</span>
                <select
                  value={draftRisk.pii === null ? "" : draftRisk.pii ? "Ja" : "Nej"}
                  onChange={(e) => setDraftRisk((r) => ({ ...r, pii: triFromYesNo(e.target.value) }))}
                >
                  <option value="">—</option>
                  <option value="Ja">Ja</option>
                  <option value="Nej">Nej</option>
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 600 }}>Legala krav</span>
                <select
                  value={draftRisk.legal_requirements === null ? "" : draftRisk.legal_requirements ? "Ja" : "Nej"}
                  onChange={(e) => setDraftRisk((r) => ({ ...r, legal_requirements: triFromYesNo(e.target.value) }))}
                >
                  <option value="">—</option>
                  <option value="Ja">Ja</option>
                  <option value="Nej">Nej</option>
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 600 }}>Finansiellt värde</span>
                <select
                  value={draftRisk.financial_value === null ? "" : draftRisk.financial_value ? "Ja" : "Nej"}
                  onChange={(e) => setDraftRisk((r) => ({ ...r, financial_value: triFromYesNo(e.target.value) }))}
                >
                  <option value="">—</option>
                  <option value="Ja">Ja</option>
                  <option value="Nej">Nej</option>
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 600 }}>Verksamhetskritikalitet</span>
                <select
                  value={draftRisk.business_criticality ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraftRisk((r) => ({ ...r, business_criticality: v ? v : null }));
                  }}
                >
                  <option value="">—</option>
                  {BUSINESS_CRIT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 600 }}>Informationsklass</span>
                <select
                  value={draftRisk.information_class ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDraftRisk((r) => ({ ...r, information_class: v ? v : null }));
                  }}
                >
                  <option value="">—</option>
                  {INFO_CLASS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 600 }}>Affärskritikalitet</span>
                <select value={draftBusinessScoreText} onChange={(e) => setDraftBusinessScoreText(e.target.value)}>
                  <option value="">—</option>
                  {BUSINESS_SCORE_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                {!businessScore.ok ? (
                  <div style={{ marginTop: 6, color: "crimson", fontSize: 12, fontWeight: 600 }}>{businessScore.error}</div>
                ) : null}
              </label>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
            <button type="button" onClick={onClose} className="btn-danger">
              Avbryt
            </button>
            <button type="button" disabled={!canCreate} onClick={onCreate} className="btn-success">
              {creating ? "Skapar…" : "Skapa"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
