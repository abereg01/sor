import { useEffect, useMemo, useState } from "react";
import type { GraphNode } from "@/api/types";
import {
  BUSINESS_CRITICALITY_VALUES,
  INFORMATION_CLASS_VALUES,
  OWNING_DEPARTMENT_OPTIONS,
  SUPPLIER_TYPE_VALUES,
  businessCriticalityLabelSv,
  informationClassLabelSv,
  supplierTypeLabelSv,
} from "@/lib/nodeDetailsValidation";

export type MetadataFilterState = {
  slaOnly: boolean;
  criticalOnly: boolean;

  env: "" | "keab" | "process";
  domain: "" | "keab" | "process";
  os: "" | "windows" | "linux";

  typ: string;
  agare: string;
  backupPolicy: string;
  interntAvdelning: string;
  leverantorTyp: string;
  verksamhetskritikalitet: string;
  informationsklass: string;

  piiOnly: boolean;
  legalaKravOnly: boolean;
  finansielltVardeOnly: boolean;
};

export const DEFAULT_METADATA_FILTERS: MetadataFilterState = {
  slaOnly: false,
  criticalOnly: false,

  env: "",
  domain: "",
  os: "",

  typ: "",
  agare: "",
  backupPolicy: "",
  interntAvdelning: "",
  leverantorTyp: "",
  verksamhetskritikalitet: "",
  informationsklass: "",

  piiOnly: false,
  legalaKravOnly: false,
  finansielltVardeOnly: false,
};

export type MetadataFilterOptions = {
  typ: { value: string; label: string }[];
  agare: { value: string; label: string }[];
  backupPolicy: { value: string; label: string }[];
  interntAvdelning: { value: string; label: string }[];
  leverantorTyp: { value: string; label: string }[];
  verksamhetskritikalitet: { value: string; label: string }[];
  informationsklass: { value: string; label: string }[];
};

const YES_SET = new Set(["ja", "sant", "true", "1", "yes"]);

function yes(v: unknown): boolean {
  if (v === true) return true;
  if (v === false) return false;
  if (typeof v === "number") return v === 1;
  if (typeof v !== "string") return false;
  return YES_SET.has(v.trim().toLowerCase());
}

function normLower(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.trim().toLowerCase();
}

function titleCase(v: string): string {
  if (!v) return v;
  return v.charAt(0).toUpperCase() + v.slice(1);
}

export function isMetadataFilterActive(f: MetadataFilterState): boolean {
  return (
    f.slaOnly ||
    f.criticalOnly ||
    f.piiOnly ||
    f.legalaKravOnly ||
    f.finansielltVardeOnly ||
    f.env !== "" ||
    f.domain !== "" ||
    f.os !== "" ||
    f.typ !== "" ||
    f.agare !== "" ||
    f.backupPolicy !== "" ||
    f.interntAvdelning !== "" ||
    f.leverantorTyp !== "" ||
    f.verksamhetskritikalitet !== "" ||
    f.informationsklass !== ""
  );
}

export function buildMetadataFilterSummarySv(f: MetadataFilterState, opts: MetadataFilterOptions): string {
  const parts: string[] = [];
  if (f.slaOnly) parts.push("SLA");
  if (f.criticalOnly) parts.push("Kritisk");
  if (f.legalaKravOnly) parts.push("Legala krav: Ja");
  if (f.finansielltVardeOnly) parts.push("Finansiellt värde: Ja");
  if (f.piiOnly) parts.push("PII: Ja");

  if (f.env) parts.push(`Miljö: ${f.env === "keab" ? "KEAB" : "Process"}`);
  if (f.domain) parts.push(`Domän: ${f.domain === "keab" ? "KEAB" : "Process"}`);
  if (f.os) parts.push(`OS: ${f.os === "windows" ? "Windows" : "Linux"}`);

  if (f.typ) parts.push(`Typ: ${opts.typ.find((x) => x.value === f.typ)?.label ?? f.typ}`);
  if (f.agare) parts.push(`Ägare: ${opts.agare.find((x) => x.value === f.agare)?.label ?? f.agare}`);
  if (f.backupPolicy) parts.push(`Backup-policy: ${opts.backupPolicy.find((x) => x.value === f.backupPolicy)?.label ?? f.backupPolicy}`);
  if (f.interntAvdelning) parts.push(`Intern avdelning: ${opts.interntAvdelning.find((x) => x.value === f.interntAvdelning)?.label ?? f.interntAvdelning}`);
  if (f.leverantorTyp) parts.push(`Typ av leverantör: ${opts.leverantorTyp.find((x) => x.value === f.leverantorTyp)?.label ?? f.leverantorTyp}`);
  if (f.verksamhetskritikalitet)
    parts.push(`Verksamhetskritikalitet: ${opts.verksamhetskritikalitet.find((x) => x.value === f.verksamhetskritikalitet)?.label ?? f.verksamhetskritikalitet}`);
  if (f.informationsklass) parts.push(`Informationsklass: ${opts.informationsklass.find((x) => x.value === f.informationsklass)?.label ?? f.informationsklass}`);

  return parts.join(" • ");
}

export function computeMatchesForMetadataFilters(args: {
  nodes: GraphNode[];
  filters: MetadataFilterState;
  selectedNodeIds: Set<string>;
  selectedNodeId?: string | null;
}): Set<string> {
  const { nodes, filters, selectedNodeIds, selectedNodeId } = args;

  const selected = new Set<string>(selectedNodeIds);
  if (selectedNodeId) selected.add(String(selectedNodeId));

  const match = new Set<string>();

  for (const n of nodes) {
    const m = (n.metadata ?? {}) as any;

    if (filters.slaOnly && !yes(m.sla)) continue;
    if (filters.criticalOnly && !yes(m.critical)) continue;

    if (filters.legalaKravOnly && !yes(m.legal_requirements)) continue;
    if (filters.finansielltVardeOnly && !yes(m.financial_value)) continue;
    if (filters.piiOnly && !yes(m.pii)) continue;

    if (filters.env !== "") {
      const v = normLower(m.env);
      if (v !== filters.env) continue;
    }

    if (filters.domain !== "") {
      const v = normLower(m.domain);
      if (v !== filters.domain) continue;
    }

    if (filters.os !== "") {
      const v = normLower(m.os);
      if (v !== filters.os) continue;
    }

    if (filters.typ !== "") {
      const k = typeof (n as any).kind === "string" ? (n as any).kind : "";
      if (k !== filters.typ) continue;
    }

    if (filters.agare !== "") {
      const v = typeof m.owner_team === "string" ? m.owner_team.trim() : "";
      if (v !== filters.agare) continue;
    }

    if (filters.backupPolicy !== "") {
      const v = typeof m.backup_policy === "string" ? m.backup_policy.trim() : "";
      if (v !== filters.backupPolicy) continue;
    }

    if (filters.interntAvdelning !== "") {
      const v = typeof m.owning_department === "string" ? m.owning_department.trim() : "";
      if (v !== filters.interntAvdelning) continue;
    }

    if (filters.leverantorTyp !== "") {
      const v = typeof m.supplier_type === "string" ? m.supplier_type.trim() : "";
      if (v !== filters.leverantorTyp) continue;
    }

    if (filters.verksamhetskritikalitet !== "") {
      const v = typeof m.business_criticality === "string" ? m.business_criticality.trim() : "";
      if (v !== filters.verksamhetskritikalitet) continue;
    }

    if (filters.informationsklass !== "") {
      const v = typeof m.information_class === "string" ? m.information_class.trim() : "";
      if (v !== filters.informationsklass) continue;
    }

    match.add(String(n.id));
  }

  for (const id of selected) match.add(id);
  return match;
}

export function buildMetadataFilterOptions(nodes: GraphNode[]): MetadataFilterOptions {
  const kindSet = new Set<string>();
  const ownerSet = new Set<string>();
  const backupSet = new Set<string>();

  for (const n of nodes) {
    if (typeof (n as any).kind === "string" && (n as any).kind.trim() !== "") kindSet.add((n as any).kind.trim());

    const m = (n.metadata ?? {}) as any;

    if (typeof m.owner_team === "string" && m.owner_team.trim() !== "") ownerSet.add(m.owner_team.trim());
    if (typeof m.backup_policy === "string" && m.backup_policy.trim() !== "") backupSet.add(m.backup_policy.trim());
  }

  const typ = Array.from(kindSet)
    .sort((a, b) => a.localeCompare(b, "sv"))
    .map((v) => ({ value: v, label: titleCase(v.replaceAll("_", " ")) }));

  const agare = Array.from(ownerSet)
    .sort((a, b) => a.localeCompare(b, "sv"))
    .map((v) => ({ value: v, label: v }));

  const backupPolicy = Array.from(backupSet)
    .sort((a, b) => a.localeCompare(b, "sv"))
    .map((v) => ({ value: v, label: v }));

  const interntAvdelning = OWNING_DEPARTMENT_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

  const leverantorTyp = SUPPLIER_TYPE_VALUES.map((v) => ({ value: v, label: supplierTypeLabelSv(v) }));

  const verksamhetskritikalitet = BUSINESS_CRITICALITY_VALUES.map((v) => ({ value: v, label: businessCriticalityLabelSv(v) }));

  const informationsklass = INFORMATION_CLASS_VALUES.map((v) => ({ value: v, label: informationClassLabelSv(v) }));

  return { typ, agare, backupPolicy, interntAvdelning, leverantorTyp, verksamhetskritikalitet, informationsklass };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  nodes: GraphNode[];
  filters: MetadataFilterState;
  onChange: (next: MetadataFilterState) => void;

  active: boolean;
  summary: string;
  onClear: () => void;

  showTrigger?: boolean;
};

export function MetadataFilterPill({
  open,
  onOpenChange,
  nodes,
  filters,
  onChange,
  active,
  summary,
  onClear,
  showTrigger = true,
}: Props) {
  const options = useMemo(() => buildMetadataFilterOptions(nodes), [nodes]);

  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }

    const t = window.setTimeout(() => setMounted(false), 160);
    return () => window.clearTimeout(t);
  }, [open]);

  return (
    <>
      {mounted ? (
        <div
          className={`qf-modal ${open ? "open" : ""}`}
          style={{
            width: "min(640px, calc(100vw - 28px))",
            borderRadius: 14,
            border: "1px solid var(--border-0)",
            background: "var(--panel-bg)",
            boxShadow: "var(--shadow-soft)",
            overflow: "hidden",
            transformOrigin: "bottom right",
            colorScheme: "light",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: 12,
              borderBottom: "1px solid var(--border-0)",
              background: "var(--panel-bg)",
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: "var(--panel-text-2)" }}>Filter</div>
              <div style={{ fontSize: 13, color: "var(--panel-text)", fontWeight: 600 }}></div>
            </div>

            <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  onClear();
                }}
                style={{
                  padding: "7px 10px",
                  borderRadius: 12,
                  border: "1px solid var(--border-0)",
                  background: "var(--panel-bg-2)",
                  color: "var(--panel-text)",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Rensa
              </button>

              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  onOpenChange(false);
                }}
                style={{
                  padding: "7px 10px",
                  borderRadius: 12,
                  border: "1px solid var(--border-0)",
                  background: "var(--panel-bg)",
                  color: "var(--panel-text)",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
                title="Stäng"
              >
                ✕
              </button>
            </div>
          </div>

          <div style={{ padding: 12 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--panel-text-2)" }}>
                <input className="qf-check" type="checkbox" checked={filters.slaOnly} onChange={(e) => onChange({ ...filters, slaOnly: e.target.checked })} />
                SLA
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--panel-text-2)" }}>
                <input className="qf-check" type="checkbox" checked={filters.criticalOnly} onChange={(e) => onChange({ ...filters, criticalOnly: e.target.checked })} />
                Kritisk
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--panel-text-2)" }}>
                <input
                  className="qf-check"
                  type="checkbox"
                  checked={filters.legalaKravOnly}
                  onChange={(e) => onChange({ ...filters, legalaKravOnly: e.target.checked })}
                />
                Legala krav
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--panel-text-2)" }}>
                <input
                  className="qf-check"
                  type="checkbox"
                  checked={filters.finansielltVardeOnly}
                  onChange={(e) => onChange({ ...filters, finansielltVardeOnly: e.target.checked })}
                />
                Finansiellt värde
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--panel-text-2)" }}>
                <input className="qf-check" type="checkbox" checked={filters.piiOnly} onChange={(e) => onChange({ ...filters, piiOnly: e.target.checked })} />
                PII
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <select className="qf-select" value={filters.env} onChange={(e) => onChange({ ...filters, env: e.target.value as any })}>
                <option value="">Miljö: Alla</option>
                <option value="keab">KEAB</option>
                <option value="process">Process</option>
              </select>

              <select className="qf-select" value={filters.domain} onChange={(e) => onChange({ ...filters, domain: e.target.value as any })}>
                <option value="">Domän: Alla</option>
                <option value="keab">KEAB</option>
                <option value="process">Process</option>
              </select>

              <select className="qf-select" value={filters.os} onChange={(e) => onChange({ ...filters, os: e.target.value as any })}>
                <option value="">OS: Alla</option>
                <option value="windows">Windows</option>
                <option value="linux">Linux</option>
              </select>

              <select className="qf-select" value={filters.typ} onChange={(e) => onChange({ ...filters, typ: e.target.value })}>
                <option value="">Typ: Alla</option>
                {options.typ.map((opt) => (
                  <option key={opt.value} value={opt.value} className="qf-option">
                    {opt.label}
                  </option>
                ))}
              </select>

              <select className="qf-select" value={filters.agare} onChange={(e) => onChange({ ...filters, agare: e.target.value })}>
                <option value="">Ägare: Alla</option>
                {options.agare.map((opt) => (
                  <option key={opt.value} value={opt.value} className="qf-option">
                    {opt.label}
                  </option>
                ))}
              </select>

              <select className="qf-select" value={filters.backupPolicy} onChange={(e) => onChange({ ...filters, backupPolicy: e.target.value })}>
                <option value="">Backup-policy: Alla</option>
                {options.backupPolicy.map((opt) => (
                  <option key={opt.value} value={opt.value} className="qf-option">
                    {opt.label}
                  </option>
                ))}
              </select>

              <select className="qf-select" value={filters.interntAvdelning} onChange={(e) => onChange({ ...filters, interntAvdelning: e.target.value })}>
                <option value="">Intern avdelning: Alla</option>
                {options.interntAvdelning.map((opt) => (
                  <option key={opt.value} value={opt.value} className="qf-option">
                    {opt.label}
                  </option>
                ))}
              </select>

              <select className="qf-select" value={filters.leverantorTyp} onChange={(e) => onChange({ ...filters, leverantorTyp: e.target.value })}>
                <option value="">Typ av leverantör: Alla</option>
                {options.leverantorTyp.map((opt) => (
                  <option key={opt.value} value={opt.value} className="qf-option">
                    {opt.label}
                  </option>
                ))}
              </select>

              <select className="qf-select" value={filters.verksamhetskritikalitet} onChange={(e) => onChange({ ...filters, verksamhetskritikalitet: e.target.value })}>
                <option value="">Verksamhetskritikalitet: Alla</option>
                {options.verksamhetskritikalitet.map((opt) => (
                  <option key={opt.value} value={opt.value} className="qf-option">
                    {opt.label}
                  </option>
                ))}
              </select>

              <select className="qf-select" value={filters.informationsklass} onChange={(e) => onChange({ ...filters, informationsklass: e.target.value })}>
                <option value="">Informationsklass: Alla</option>
                {options.informationsklass.map((opt) => (
                  <option key={opt.value} value={opt.value} className="qf-option">
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  onOpenChange(false);
                }}
                style={{
                  padding: "9px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--border-0)",
                  background: "var(--panel-bg)",
                  color: "var(--panel-text)",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Stäng
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showTrigger ? (
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            onOpenChange(!open);
          }}
          style={{
            width: "min(560px, calc(100vw - 28px))",
            borderRadius: 14,
            border: active ? "1px solid var(--success-border)" : "1px solid var(--border-0)",
            background: active ? "var(--warning-bg)" : "var(--panel-bg)",
            color: "var(--panel-text)",
            boxShadow: active ? "0 10px 28px var(--shadow-elev-1)" : "var(--shadow-soft)",
            padding: "10px 12px",
            cursor: "pointer",
            textAlign: "left",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
          title="Filter"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "var(--panel-text-2)" }}>Filter</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--panel-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {summary}
            </div>
          </div>

          {active ? (
            <span
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClear();
              }}
              style={{
                marginLeft: "auto",
                padding: "6px 10px",
                borderRadius: 12,
                border: "1px solid var(--border-0)",
                background: "var(--panel-bg-2)",
                color: "var(--panel-text)",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
              }}
              title="Rensa filter"
            >
              Rensa
            </span>
          ) : null}

          <span style={{ marginLeft: "auto", color: "var(--panel-text-2)", fontSize: 12 }}>{open ? "▼" : "▲"}</span>
        </button>
      ) : null}
    </>
  );
}
