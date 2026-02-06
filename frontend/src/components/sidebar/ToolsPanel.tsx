import type { GraphLink, GraphNode, SchemaKindsResponse } from "@/api/types";

import { ExportPanel } from "@/components/export/ExportPanel";
import { ImportPanel } from "@/components/imports/ImportPanel";

type TabKey = "import" | "export";

type Props = {
  tab: TabKey;
  onTabChange: (t: TabKey) => void;
  nodes: GraphNode[];
  links: GraphLink[];
  schema: SchemaKindsResponse | null;
  onRefreshGraph: () => void;
  onError: (msg: string) => void;
};

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`sidebar-tab${active ? " active" : ""}`}
      onClick={onClick}
      type="button"
      aria-current={active ? "page" : undefined}
    >
      {label}
    </button>
  );
}

export function ToolsPanel({ tab, onTabChange, nodes, links, schema, onRefreshGraph, onError }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", overflowX: "hidden" }}>
      <div className="sidebar-tabs" role="tablist" aria-label="Verktyg">
        <TabButton active={tab === "import"} label="Import" onClick={() => onTabChange("import")} />
        <TabButton active={tab === "export"} label="Export" onClick={() => onTabChange("export")} />
      </div>

      <div style={{ width: "100%", overflowX: "hidden" }}>
        {tab === "import" && (
          <ImportPanel nodes={nodes} links={links} schema={schema} onRefreshGraph={onRefreshGraph} onError={onError} />
        )}
        {tab === "export" && <ExportPanel nodes={nodes} />}
      </div>
    </div>
  );
}
