import React, { useMemo } from "react";
import type { GraphNode } from "@/api/types";
import { t } from "@/i18n";

export type DatatrafikFilters = {
  enabled: boolean;

  showProposals: boolean;

  direction: "all" | "outgoing" | "incoming";
  dataCategoryId: string;
  flowType: string;
};

export type DatatrafikLegendItem = {
  id: string;
  color: string;
  name: string;
};

type Props = {
  nodes: GraphNode[];
  availableFlowTypes: string[];
  value: DatatrafikFilters;
  onChange: (next: DatatrafikFilters) => void;
  legend: DatatrafikLegendItem[];
};

function legendRowStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 12,
    border: active ? "1px solid var(--focus-border)" : "1px solid var(--border-subtle)",
    background: active ? "var(--info-bg)" : "var(--surface)",
    cursor: "pointer",
    userSelect: "none",
  };
}

function buttonStyle(): React.CSSProperties {
  return {
    padding: "7px 10px",
    borderRadius: 10,
    border: "1px solid var(--border-strong)",
    background: "var(--surface-2)",
    color: "var(--panel-bg-2)",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 12,
  };
}

export function DatatrafikPanel({ nodes, availableFlowTypes, value, onChange, legend }: Props) {
  const dataCategories = useMemo(() => {
    return nodes
      .filter((n) => (n.kind || "").toLowerCase() === "data_category")
      .map((n) => ({ id: n.id, name: n.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [nodes]);

  const legendAllActive = value.dataCategoryId === "__all__";

  const isFiltered =
    value.direction !== "all" || value.dataCategoryId !== "__all__" || value.flowType !== "__all__";

  const resetFilters = () => {
    onChange({
      ...value,
      enabled: false,
      direction: "all",
      dataCategoryId: "__all__",
      flowType: "__all__",
    });
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={value.showProposals}
          onChange={(e) => onChange({ ...value, showProposals: e.target.checked })}
        />
        <div>
          <div style={{ fontWeight: 600 }}>{t("datatrafik.showProposals")}</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>{t("datatrafik.showProposalsHelp")}</div>
        </div>
      </label>

      <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
        />
        <div>
          <div style={{ fontWeight: 600 }}>{t("datatrafik.enable")}</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>{t("datatrafik.enableHelp")}</div>
        </div>
      </label>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button
          type="button"
          style={{
            ...buttonStyle(),
            opacity: 1,
            cursor: "pointer",
          }}
          onClick={resetFilters}
          title="Återställ riktning, kategori och typ"
        >
          {t("datatrafik.clearFilters")}
        </button>

        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {value.enabled ? (isFiltered ? "Filter aktiva" : "Inga filter") : "Inga filter (allt visas)"}
        </div>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, opacity: 0.75 }}>{t("datatrafik.direction")}</div>
        <select
          value={value.direction}
          onChange={(e) => onChange({ ...value, direction: e.target.value as any })}
          disabled={!value.enabled}
        >
          <option value="all">{t("datatrafik.directionAll")}</option>
          <option value="outgoing">{t("datatrafik.directionOutgoing")}</option>
          <option value="incoming">{t("datatrafik.directionIncoming")}</option>
        </select>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, opacity: 0.75 }}>{t("datatrafik.category")}</div>
        <select
          value={value.dataCategoryId}
          onChange={(e) => onChange({ ...value, dataCategoryId: e.target.value })}
          disabled={!value.enabled}
        >
          <option value="__all__">{t("datatrafik.categoryAll")}</option>
          <option value="__none__">Okategoriserat</option>
          {dataCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div style={{ fontSize: 12, opacity: 0.7 }}>{t("datatrafik.categoryHelp")}</div>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 12, opacity: 0.75 }}>{t("datatrafik.flowType")}</div>
        <select
          value={value.flowType}
          onChange={(e) => onChange({ ...value, flowType: e.target.value })}
          disabled={!value.enabled}
        >
          <option value="__all__">{t("datatrafik.flowTypeAll")}</option>
          {availableFlowTypes
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b))
            .map((ft) => (
              <option key={ft} value={ft}>
                {ft}
              </option>
            ))}
        </select>
      </div>

      {legend.length > 0 && (
        <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12, opacity: 0.75 }}>{t("datatrafik.legend")}</div>

          <div style={{ display: "grid", gap: 6 }}>
            <div
              style={{ ...legendRowStyle(legendAllActive), opacity: value.enabled ? 1 : 0.85 }}
              onClick={() =>
                onChange({
                  ...value,
                  enabled: true,
                  dataCategoryId: "__all__",
                })
              }
              title="Visa alla kategorier"
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background:
                    "var(--grad-accent-soft)",
                  border: "1px solid var(--border-strong)",
                  boxShadow: "0 0 0 1px var(--shadow-elev-2) inset",
                }}
              />
              <div style={{ fontSize: 13, opacity: 0.92 }}>{t("datatrafik.categoryAll")}</div>
              {legendAllActive && (
                <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.8 }}>✓</div>
              )}
            </div>

            {legend.map((it) => {
              const active = value.dataCategoryId === it.id;

              return (
                <div
                  key={it.id}
                  style={legendRowStyle(active)}
                  onClick={() => {
                    onChange({
                      ...value,
                      enabled: true,
                      dataCategoryId: active ? "__all__" : it.id,
                    });
                  }}
                  title={active ? "Klicka för att visa alla igen" : "Klicka för att filtrera"}
                >
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      background: it.color,
                      border: "1px solid var(--border-strong)",
                      boxShadow: "0 0 0 1px var(--shadow-elev-2) inset",
                    }}
                  />
                  <div style={{ fontSize: 13, opacity: 0.92 }}>{it.name}</div>
                  {active && <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.8 }}>✓</div>}
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Tips: klicka på en färg för att filtrera. Klicka igen för att återställa.
          </div>
        </div>
      )}
    </div>
  );
}
