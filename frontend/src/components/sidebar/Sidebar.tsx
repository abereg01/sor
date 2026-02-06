import { useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  History,
  LogIn,
  PlusSquare,
  Power,
  Wrench,
} from "lucide-react";

import type { GraphLink, GraphNode, SchemaKindsResponse } from "@/api/types";
import type { HighlightState } from "@/lib/highlight";
import type { DatatrafikFilters, DatatrafikLegendItem } from "@/components/flows/DatatrafikPanel";

import { ExportPanel } from "@/components/export/ExportPanel";
import NeedsReviewPanel from "@/components/review/NeedsReviewPanel";
import { HistorikModal } from "@/components/history/HistorikModal";

export type SidebarToolKey = "create_node" | "tools" | "review";

type Props = {
  nodes: GraphNode[];
  links: GraphLink[];
  schema: SchemaKindsResponse | null;

  refreshToken: number;

  selectedNodeId: string | null;
  selectedNodeIds: string[];
  selectedEdgeId: string | null;

  highlight: HighlightState;
  datatrafik: DatatrafikFilters;
  datatrafikLegend: DatatrafikLegendItem[];

  activeTool: SidebarToolKey | null;
  expanded: boolean;

  onExpandedChange: (v: boolean) => void;
  onToolChange: (k: SidebarToolKey) => void;
  onCloseTool: () => void;

  onOpenInspector: (mode?: "normal" | "review") => void;
  onHighlight: (h: HighlightState) => void;
  onError: (msg: string) => void;
  onRefresh: () => Promise<void> | void;

  onSelectNode: (id: string) => void;
  onSelectEdge: (id: string) => void;
  onDatatrafikChange: (v: DatatrafikFilters) => void;
  onDatatrafikLegendChange: (v: DatatrafikLegendItem[]) => void;

  onOpenCreateNode: () => void;

  me: { username: string; role: string } | null;
  onLogin: () => void;
  onLogout: () => void;
};

function MenuRow({
  expanded,
  active,
  label,
  icon,
  hasDropdown,
  onClick,
}: {
  expanded: boolean;
  active: boolean;
  label: string;
  icon: React.ReactNode;
  hasDropdown: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`sidebar-menu-row${expanded ? " expanded" : ""}${active ? " active" : ""}`}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <span className="sidebar-menu-left">
        <span className="sidebar-menu-icon">{icon}</span>
        {expanded && <span className="sidebar-menu-label">{label}</span>}
      </span>

      {expanded && hasDropdown && (
        <span className={`sidebar-menu-chevron${active ? " open" : ""}`}>
          <ChevronDown size={18} />
        </span>
      )}
    </button>
  );
}

export function Sidebar({
  refreshToken,
  nodes,
  links,
  onOpenCreateNode,
  activeTool,
  expanded,
  onExpandedChange,
  onToolChange,
  onCloseTool,
  onOpenInspector,
  onError,
  onRefresh,
  onSelectNode,
  onSelectEdge,
  me,
  onLogin,
  onLogout,
}: Props) {
  const [historyOpen, setHistoryOpen] = useState(false);

  function openTool(key: SidebarToolKey) {
    if (!expanded) onExpandedChange(true);
    if (activeTool === key) onCloseTool();
    else onToolChange(key);
  }

  function collapseAll() {
    onCloseTool();
    onExpandedChange(false);
  }

  return (
    <aside className={`sidebar-rail panel-light context-sidebar${expanded ? " expanded" : ""}`}>
      <div className="sidebar-scroll">
        <div className="sidebar-menu">
          <MenuRow
            expanded={expanded}
            active={false}
            label="Skapa ny nod"
            icon={<PlusSquare size={20} className="sidebar-icon sidebar-icon-create" />}
            hasDropdown={false}
            onClick={() => {
              if (!expanded) onExpandedChange(true);
              onOpenCreateNode();
            }}
          />

          <MenuRow
            expanded={expanded}
            active={activeTool === "tools"}
            label="Verktyg"
            icon={<Wrench size={20} className="sidebar-icon sidebar-icon-tools" />}
            hasDropdown
            onClick={() => openTool("tools")}
          />

          {expanded && activeTool === "tools" ? (
            <div className="sidebar-accordion sidebar-accordion-anim">
              <div className="sidebar-tools-group">
                <button type="button" className="sidebar-tools-btn" onClick={() => setHistoryOpen(true)}>
                  <span className="sidebar-tools-btn-icon">
                    <History size={18} />
                  </span>
                  <span className="sidebar-tools-btn-label">Historik</span>
                </button>

                <ExportPanel nodes={nodes} variant="sidebar" />
              </div>
            </div>
          ) : null}

          <MenuRow
            expanded={expanded}
            active={activeTool === "review"}
            label="Granska"
            icon={<ClipboardList size={20} className="sidebar-icon sidebar-icon-review" />}
            hasDropdown
            onClick={() => openTool("review")}
          />

          {expanded && activeTool === "review" ? (
            <div className="sidebar-accordion sidebar-accordion-anim">
              <NeedsReviewPanel
                nodes={nodes}
                onError={onError}
                refreshToken={refreshToken}
                onSelectEdge={(edgeId: string) => {
                  onSelectEdge(edgeId);
                  collapseAll();
                  onOpenInspector("review");
                }}
                onSelectNode={(nodeId: string) => {
                  onSelectNode(nodeId);
                  collapseAll();
                  onOpenInspector("review");
                }}
              />
            </div>
          ) : null}

          {!me ? (
            <MenuRow
              expanded={expanded}
              active={false}
              label="Logga in"
              icon={<LogIn size={20} className="sidebar-icon sidebar-icon-login" />}
              hasDropdown={false}
              onClick={onLogin}
            />
          ) : null}
        </div>
      </div>

      <div className="sidebar-footer">
        {me ? (
          <button
            type="button"
            className="sidebar-logout-btn"
            onClick={onLogout}
            title="Logga ut"
            aria-label="Logga ut"
          >
            <Power size={20} className="sidebar-icon sidebar-icon-logout" />
            {expanded ? <span className="sidebar-logout-label">Logga ut</span> : null}
          </button>
        ) : null}
        <button
          type="button"
          className={`sidebar-collapse-btn${expanded ? " expanded" : ""}`}
          onClick={() => {
            onCloseTool();
            onExpandedChange(!expanded);
          }}
          title={expanded ? "Fäll in" : "Fäll ut"}
          aria-label={expanded ? "Fäll in" : "Fäll ut"}
        >
          <span className="sidebar-collapse-icon">
            {expanded ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </span>
        </button>
      </div>

      <HistorikModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        nodes={nodes}
        links={links}
        onRefresh={onRefresh}
        onError={onError}
      />
    </aside>
  );
}
