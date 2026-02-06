import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FileDown, X } from "lucide-react";

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

type Format = "xlsx" | "json" | "csv";

type EdgeScope = "both" | "any";

type ConditionKind = "node_kind" | "meta";
type ConditionOp = "eq" | "neq";

type MetaFieldKey =
  | "owner"
  | "backup_policy"
  | "environment"
  | "critical"
  | "domain"
  | "sla"
  | "owning_department"
  | "supplier_type"
  | "pii"
  | "legal_requirements"
  | "financial_value"
  | "business_criticality"
  | "information_class"
  | "os";

type Condition =
  | {
      id: string;
      kind: "node_kind";
      op: ConditionOp;
      value: string;
    }
  | {
      id: string;
      kind: "meta";
      op: ConditionOp;
      key: MetaFieldKey;
      value: string;
    };

type Group = {
  id: string;
  conditions: Condition[];
};

type FilterSpec = {
  groups: Group[];
};

type Props = {
  nodes: GraphNode[];
  variant?: "sidebar" | "default";
};

const NODE_KIND_LABELS: Array<{ value: string; label: string }> = [
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

const ENV_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "dev", label: "Dev" },
  { value: "test", label: "Test" },
  { value: "stage", label: "Stage" },
  { value: "prod", label: "Prod" },
];

const DOMAIN_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "KEAB", label: "KEAB" },
  { value: "Process", label: "Process" },
];

const OS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "Windows", label: "Windows" },
  { value: "Linux", label: "Linux" },
];

const YES_NO: Array<{ value: string; label: string }> = [
  { value: "true", label: "Ja" },
  { value: "false", label: "Nej" },
];

const SUPPLIER_TYPE_OPTIONS: Array<{ value: string; label: string }> = SUPPLIER_TYPE_VALUES.map((v) => ({
  value: v,
  label: supplierTypeLabelSv(v),
}));

const BUSINESS_CRITICALITY_OPTIONS: Array<{ value: string; label: string }> = BUSINESS_CRITICALITY_VALUES.map((v) => ({
  value: v,
  label: businessCriticalityLabelSv(v),
}));

const INFORMATION_CLASS_OPTIONS: Array<{ value: string; label: string }> = INFORMATION_CLASS_VALUES.map((v) => ({
  value: v,
  label: informationClassLabelSv(v),
}));

const META_FIELDS: Array<{ key: MetaFieldKey; label: string }> = [
  { key: "owner", label: "Ägare" },
  { key: "backup_policy", label: "Backup-policy" },
  { key: "environment", label: "Miljö" },
  { key: "critical", label: "Kritisk" },
  { key: "domain", label: "Domän" },
  { key: "sla", label: "SLA" },
  { key: "owning_department", label: "Intern avdelning" },
  { key: "supplier_type", label: "Typ av leverantör" },
  { key: "pii", label: "PII" },
  { key: "legal_requirements", label: "Legala krav" },
  { key: "financial_value", label: "Finansiellt värde" },
  { key: "business_criticality", label: "Verksamhetskritikalitet" },
  { key: "information_class", label: "Informationsklass" },
  { key: "os", label: "OS" },
];

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function asStrings(v: any): string[] {
  if (v === null || v === undefined) return [];
  if (typeof v === "string") return v.trim() ? [v.trim()] : [];
  if (typeof v === "number") return [String(v)];
  if (typeof v === "boolean") return [v ? "true" : "false"];
  if (Array.isArray(v)) {
    const out: string[] = [];
    for (const x of v) out.push(...asStrings(x));
    return out;
  }
  if (typeof v === "object") {
    const name = (v as any).name;
    if (typeof name === "string" && name.trim()) return [name.trim()];
  }
  return [];
}

function metaValue(meta: any, key: string) {
  if (!meta || typeof meta !== "object") return undefined;
  const v = (meta as any)[key];
  if (v === null || v === undefined) return undefined;
  return v;
}

function matchesCondition(n: GraphNode, c: Condition): boolean {
  if (c.kind === "node_kind") {
    const actual = (n.kind ?? "").trim();
    if (!actual) return false;
    return c.op === "eq" ? actual === c.value : actual !== c.value;
  }

  const actual = metaValue(n.metadata, c.key);
  const values = asStrings(actual);
  if (!values.length) return false;

  const ok = values.some((v) => v === c.value);
  return c.op === "eq" ? ok : !ok;
}

function matchesSpec(n: GraphNode, spec: FilterSpec): boolean {
  if (!spec.groups.length) return true;
  return spec.groups.some((g) => {
    if (!g.conditions.length) return true;
    return g.conditions.every((c) => matchesCondition(n, c));
  });
}

function encodeBase64UrlUtf8(s: string) {
  const utf8 = encodeURIComponent(s).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16)));
  const b64 = btoa(utf8);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function toBackendSpec(spec: FilterSpec) {
  return {
    groups: spec.groups.map((g) => ({
      conditions: g.conditions.map((c) => {
        if (c.kind === "node_kind") {
          return { field: "kind", op: c.op, value: c.value };
        }
        const valueJson = c.value === "true" ? true : c.value === "false" ? false : c.value;
        return { field: "meta", op: c.op, key: c.key, value: valueJson };
      }),
    })),
  };
}

function buildExportUrl(
  format: Format,
  params: { f?: string; include_edges: boolean; include_claims: boolean; include_flows: boolean; edge_scope: EdgeScope }
) {
  const base =
    format === "json"
      ? "/api/export/snapshot.json"
      : format === "csv"
        ? "/api/export/snapshot.csv"
        : "/api/export/snapshot.xlsx";

  const qs = new URLSearchParams();
  if (params.f) qs.set("f", params.f);
  if (!params.include_edges) qs.set("include_edges", "false");
  if (!params.include_claims) qs.set("include_claims", "false");
  if (!params.include_flows) qs.set("include_flows", "false");
  if (params.edge_scope !== "both") qs.set("edge_scope", params.edge_scope);

  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

function labelForKind(kind: string) {
  const hit = NODE_KIND_LABELS.find((k) => k.value === kind);
  return hit ? hit.label : kind;
}

export function ExportPanel({ nodes, variant = "default" }: Props) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>("xlsx");
  const [exporting, setExporting] = useState(false);

  const [includeEdges, setIncludeEdges] = useState(true);
  const [includeClaims, setIncludeClaims] = useState(true);
  const [includeFlows, setIncludeFlows] = useState(true);
  const [edgeScope, setEdgeScope] = useState<EdgeScope>("both");

  const kindOptions = useMemo(() => {
    const set = new Set<string>();
    for (const n of nodes) {
      const k = (n.kind ?? "").trim();
      if (k) set.add(k);
    }
    return Array.from(set).sort((a, b) => labelForKind(a).localeCompare(labelForKind(b), "sv"));
  }, [nodes]);

  const dynamicMetaValues = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const n of nodes) {
      for (const f of META_FIELDS) {
        const v = metaValue(n.metadata, f.key);
        if (v === undefined) continue;
        const xs = asStrings(v);
        if (!xs.length) continue;
        const set = map.get(f.key) ?? new Set<string>();
        for (const x of xs) set.add(x);
        map.set(f.key, set);
      }
    }

    const out: Record<string, string[]> = {};
    for (const [k, s] of map.entries()) {
      out[k] = Array.from(s)
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 250)
        .sort((a, b) => a.localeCompare(b, "sv"));
    }
    return out;
  }, [nodes]);

  function valueOptionsForField(key: MetaFieldKey): Array<{ value: string; label: string }> {
    if (key === "critical" || key === "sla" || key === "pii" || key === "legal_requirements") return YES_NO;
    if (key === "environment") return ENV_OPTIONS;
    if (key === "domain") return DOMAIN_OPTIONS;
    if (key === "os") return OS_OPTIONS;
    if (key === "owning_department") return OWNING_DEPARTMENT_OPTIONS;
    if (key === "supplier_type") return SUPPLIER_TYPE_OPTIONS;
    if (key === "business_criticality") return BUSINESS_CRITICALITY_OPTIONS;
    if (key === "information_class") return INFORMATION_CLASS_OPTIONS;

    const dyn = dynamicMetaValues[key] ?? [];
    return dyn.map((v) => ({ value: v, label: v }));
  }

  const [spec, setSpec] = useState<FilterSpec>(() => ({ groups: [] }));

  const preview = useMemo(() => {
    const nodeCount = nodes.filter((n) => matchesSpec(n, spec)).length;
    const hasFilter = spec.groups.some((g) => g.conditions.length > 0);
    return { nodeCount, hasFilter };
  }, [nodes, spec]);

  function addGroup() {
    const defaultKind = kindOptions[0] ?? "system";
    setSpec((s) => ({
      groups: [
        ...s.groups,
        { id: uid("g"), conditions: [{ id: uid("c"), kind: "node_kind", op: "eq", value: defaultKind }] },
      ],
    }));
  }

  function removeGroup(groupId: string) {
    setSpec((s) => ({ groups: s.groups.filter((g) => g.id !== groupId) }));
  }

  function addCondition(groupId: string) {
    setSpec((s) => ({
      groups: s.groups.map((g) => {
        if (g.id !== groupId) return g;
        const defaultKey: MetaFieldKey = "critical";
        const vs = valueOptionsForField(defaultKey);
        const defaultValue = vs[0]?.value ?? "true";
        return {
          ...g,
          conditions: [...g.conditions, { id: uid("c"), kind: "meta", op: "eq", key: defaultKey, value: defaultValue }],
        };
      }),
    }));
  }

  function removeCondition(groupId: string, condId: string) {
    setSpec((s) => ({
      groups: s.groups.map((g) =>
        g.id !== groupId ? g : { ...g, conditions: g.conditions.filter((c) => c.id !== condId) }
      ),
    }));
  }

  function updateCondition(groupId: string, condId: string, patch: Partial<Condition>) {
    setSpec((s) => ({
      groups: s.groups.map((g) => {
        if (g.id !== groupId) return g;
        return { ...g, conditions: g.conditions.map((c) => (c.id !== condId ? c : ({ ...c, ...patch } as any))) };
      }),
    }));
  }

  function resetAll() {
    setSpec({ groups: [] });
    setIncludeEdges(true);
    setIncludeClaims(true);
    setIncludeFlows(true);
    setEdgeScope("both");
    setFormat("xlsx");
  }

  function onExport() {
    if (exporting) return;
    setExporting(true);

    const backendSpec = toBackendSpec(spec);
    const json = JSON.stringify(backendSpec);
    const f = preview.hasFilter ? encodeBase64UrlUtf8(json) : undefined;

    const url = buildExportUrl(format, {
      f,
      include_edges: includeEdges,
      include_claims: includeClaims,
      include_flows: includeFlows && includeClaims,
      edge_scope: edgeScope,
    });

    const link = document.createElement("a");
    link.href = url;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => setExporting(false), 350);
  }

  const trigger = (
    <button type="button" className={variant === "sidebar" ? "sidebar-tools-btn" : "export-trigger"} onClick={() => setOpen(true)}>
      {variant === "sidebar" ? (
        <>
          <span className="sidebar-tools-btn-icon">
            <FileDown size={18} />
          </span>
          <span className="sidebar-tools-btn-label">Exportera</span>
        </>
      ) : (
        <>
          <FileDown size={18} />
          <span>Exportera</span>
        </>
      )}
    </button>
  );

  return (
    <div className={variant === "sidebar" ? undefined : "panel-subtle export-panel-root"}>
      {trigger}

      {open
        ? createPortal(
            <div
              className="modal-overlay export-modal-overlay"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <div className="modal-surface modal-surface-elev panel-light context-panel export-modal-surface">
                <div className="export-modal-header">
                  <div className="export-modal-title">Exportera</div>
                  <button
                    type="button"
                    className="export-modal-close"
                    onClick={() => setOpen(false)}
                    title="Stäng"
                    aria-label="Stäng"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="export-modal-body">
                  <div className="card-light">
                    <div className="export-card-header">
                      <div>
                        <div className="export-card-title">Urval</div>
                        <div className="export-card-subtitle">
                          Resultat: <span className="export-card-strong">{preview.nodeCount}</span> noder
                        </div>
                      </div>

                      <div className="export-card-actions">
                        <button type="button" onClick={addGroup}>
                          + Grupp
                        </button>
                        <button type="button" onClick={resetAll}>
                          Återställ allt
                        </button>
                      </div>
                    </div>

                    {spec.groups.length === 0 ? <div className="export-empty-hint">Full export (inga filter)</div> : null}

                    <div className="export-groups">
                      {spec.groups.map((g, gi) => (
                        <div key={g.id} className="panel-subtle export-group">
                          <div className="export-group-header">
                            <div className="export-group-title">Grupp {gi + 1}</div>
                            <div className="export-group-actions">
                              <button type="button" onClick={() => addCondition(g.id)}>
                                + Villkor
                              </button>
                              <button type="button" onClick={() => removeGroup(g.id)}>
                                Ta bort grupp
                              </button>
                            </div>
                          </div>

                          <div className="export-conditions">
                            {g.conditions.map((c, ci) => {
                              const leftLabel = ci === 0 ? "Villkor" : "AND";

                              return (
                                <div key={c.id} className="export-condition-row">
                                  <div className="export-condition-label">{leftLabel}</div>

                                  <select
                                    className="qf-select"
                                    value={c.kind}
                                    onChange={(e) => {
                                      const kind = e.target.value as ConditionKind;
                                      if (kind === "node_kind") {
                                        const defaultKind = kindOptions[0] ?? "system";
                                        updateCondition(g.id, c.id, { kind: "node_kind", op: "eq", value: defaultKind } as any);
                                      } else {
                                        const defaultKey: MetaFieldKey = "critical";
                                        const vs = valueOptionsForField(defaultKey);
                                        const defaultValue = vs[0]?.value ?? "true";
                                        updateCondition(g.id, c.id, { kind: "meta", op: "eq", key: defaultKey, value: defaultValue } as any);
                                      }
                                    }}
                                  >
                                    <option value="node_kind">Typ</option>
                                    <option value="meta">Innehåll</option>
                                  </select>

                                  <select
                                    className="qf-select"
                                    value={c.op}
                                    onChange={(e) => updateCondition(g.id, c.id, { op: e.target.value as ConditionOp } as any)}
                                  >
                                    <option value="eq">är</option>
                                    <option value="neq">är inte</option>
                                  </select>

                                  {c.kind === "node_kind" ? (
                                    <select
                                      className="qf-select"
                                      value={c.value}
                                      onChange={(e) => updateCondition(g.id, c.id, { value: e.target.value } as any)}
                                    >
                                      {kindOptions.map((k) => (
                                        <option key={k} value={k}>
                                          {labelForKind(k)}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <div className="export-meta-grid">
                                      <select
                                        className="qf-select"
                                        value={c.key}
                                        onChange={(e) => {
                                          const key = e.target.value as MetaFieldKey;
                                          const vs = valueOptionsForField(key);
                                          const nextValue = vs[0]?.value ?? "";
                                          updateCondition(g.id, c.id, { key, value: nextValue } as any);
                                        }}
                                      >
                                        {META_FIELDS.map((f) => (
                                          <option key={f.key} value={f.key}>
                                            {f.label}
                                          </option>
                                        ))}
                                      </select>

                                      <select
                                        className="qf-select"
                                        value={c.value}
                                        onChange={(e) => updateCondition(g.id, c.id, { value: e.target.value } as any)}
                                      >
                                        {valueOptionsForField(c.key).map((o) => (
                                          <option key={o.value} value={o.value}>
                                            {o.label}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}

                                  <button
                                    type="button"
                                    className="export-remove-cond"
                                    onClick={() => removeCondition(g.id, c.id)}
                                    title="Ta bort"
                                    aria-label="Ta bort"
                                  >
                                    ×
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card-light">
                    <div className="export-section-title">Innehåll</div>

                    <div className="export-content-grid">
                      <div className="export-field">
                        <span className="export-field-label">Format</span>
                        <select className="qf-select" value={format} onChange={(e) => setFormat(e.target.value as Format)}>
                          <option value="xlsx">XLSX (standard)</option>
                          <option value="json">JSON</option>
                          <option value="csv">CSV</option>
                        </select>

                        <div className="export-flags-grid">
                          <label className="export-flag">
                            <input type="checkbox" checked={includeClaims} onChange={(e) => setIncludeClaims(e.target.checked)} />
                            <span className="export-flag-label">Claim (nuvarande)</span>
                          </label>

                          <label className="export-flag">
                            <input
                              type="checkbox"
                              checked={includeFlows && includeClaims}
                              disabled={!includeClaims}
                              onChange={(e) => setIncludeFlows(e.target.checked)}
                            />
                            <span className="export-flag-label">Dataflöden (nuvarande)</span>
                          </label>

                          <label className="export-flag">
                            <input type="checkbox" checked={includeEdges} onChange={(e) => setIncludeEdges(e.target.checked)} />
                            <span className="export-flag-label">Kopplingar</span>
                          </label>
                        </div>
                      </div>

                      <label className="export-field">
                        <span className="export-field-label">Kopplingsurval</span>
                        <select className="qf-select" value={edgeScope} onChange={(e) => setEdgeScope(e.target.value as EdgeScope)}>
                          <option value="both">Båda ändar i urvalet</option>
                          <option value="any">Minst en ände i urvalet</option>
                        </select>
                      </label>
                    </div>

                    <div className="export-footer-actions">
                      <button type="button" onClick={() => setOpen(false)}>
                        Avbryt
                      </button>
                      <button type="button" onClick={onExport} disabled={exporting}>
                        {exporting ? "Exporterar…" : "Exportera"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
