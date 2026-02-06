import { useEffect, useMemo, useRef, useState } from "react";

import {
  fetchGraph,
  fetchSchemaKinds,
  fetchMe,
  loginLocal,
  logoutLocal,
  getAuthToken,
  setAuthToken,
} from "./api/client";
import type { GraphLink, GraphNode, SchemaKindsResponse } from "./api/types";
import { GraphView, type GraphViewHandle } from "@/components/graph/view/GraphView";
import { Sidebar, type SidebarToolKey } from "@/components/sidebar/Sidebar";
import { PanelDrawer } from "@/components/layout/PanelDrawer";
import { InspectorPanel } from "@/components/inspector/InspectorPanel";
import { emptyHighlight, type HighlightState } from "./lib/highlight";
import type { DatatrafikFilters, DatatrafikLegendItem } from "./components/flows/DatatrafikPanel";
import { ErrorModal } from "./components/ui/ErrorModal";
import { CreateNodeModal } from "./components/nodes/CreateNodeModal";
import { LoginModal } from "./components/auth/LoginModal";

type NodeSelectOpts = {
  toggle?: boolean;
  add?: boolean;
};

function isTypingTarget(el: EventTarget | null) {
  const a = el as HTMLElement | null;
  if (!a) return false;
  const tag = (a.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (a.isContentEditable) return true;
  return false;
}

export default function App() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [schema, setSchema] = useState<SchemaKindsResponse | null>(null);

  const [me, setMe] = useState<{ username: string; role: string } | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);

  const [selectedNodeId, setSelectedNodeId] = useState<string>("");
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>("");

  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorMode, setInspectorMode] = useState<"normal" | "review">("normal");

  const [highlight, setHighlight] = useState<HighlightState>(emptyHighlight());
  const [error, setError] = useState<string | null>(null);

  const [activeTool, setActiveTool] = useState<SidebarToolKey | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const [createNodeOpen, setCreateNodeOpen] = useState(false);

  const [datatrafik, setDatatrafik] = useState<DatatrafikFilters>({
    enabled: true,
    showProposals: false,
    direction: "all",
    dataCategoryId: "__all__",
    flowType: "__all__",
  });

  const [datatrafikLegend, setDatatrafikLegend] = useState<DatatrafikLegendItem[]>([]);

  const graphRef = useRef<GraphViewHandle | null>(null);

  const [refreshSeq, setRefreshSeq] = useState(0);

  async function refreshGraph(opts?: { includeReview?: boolean }) {
    const includeReview =
      typeof opts?.includeReview === "boolean" ? opts.includeReview : datatrafik.showProposals;
    const g = await fetchGraph({ includeReview });
    setNodes(g.nodes);
    setLinks(g.links);
    setRefreshSeq((x) => x + 1);
  }

  async function bootstrapAuth() {
    const token = getAuthToken();
    if (!token) {
      setMe(null);
      return;
    }

    try {
      const u = await fetchMe();
      setMe(u);
    } catch {
      setAuthToken("");
      setMe(null);
    }
  }

  useEffect(() => {
    bootstrapAuth().catch(() => {});
  }, []);

  useEffect(() => {
    refreshGraph().catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    fetchSchemaKinds()
      .then(setSchema)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    refreshGraph({ includeReview: datatrafik.showProposals }).catch((e: unknown) =>
      setError(e instanceof Error ? e.message : String(e)),
    );
  }, [datatrafik.showProposals]);

  const normalizedHighlight = useMemo(() => {
    return {
      nodeIds: new Set(Array.from(highlight.nodeIds)),
      edgeIds: new Set(Array.from(highlight.edgeIds)),
      label: highlight.label,
      dimOthers: highlight.dimOthers,
    } as HighlightState;
  }, [highlight]);

  const selectedNodeIdSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);

  function onError(msg: string) {
    setError(msg);
    setTimeout(() => setError(null), 7000);
  }

  function clearSelection() {
    setSelectedEdgeId("");
    setSelectedNodeId("");
    setSelectedNodeIds([]);
    setInspectorMode("normal");
    setInspectorOpen(false);
  }

  function selectSingleNode(id: string) {
    setInspectorMode("normal");
    setSelectedNodeId(id);
    setSelectedNodeIds(id ? [id] : []);
    setSelectedEdgeId("");
    setInspectorOpen(true);
  }

  function selectNodeWithOpts(id: string, opts?: NodeSelectOpts) {
    if (!id) return;

    if (
      !opts?.toggle &&
      !opts?.add &&
      selectedNodeIds.length === 1 &&
      selectedNodeIds[0] === id &&
      !selectedEdgeId
    ) {
      clearSelection();
      return;
    }

    if (opts?.toggle || opts?.add) {
      setInspectorMode("normal");
      setSelectedEdgeId("");
      setSelectedNodeId(id);
      setSelectedNodeIds((prev) => {
        const set = new Set(prev);
        if (opts.toggle && set.has(id)) set.delete(id);
        else set.add(id);
        return Array.from(set);
      });
      setInspectorOpen(true);
      return;
    }

    selectSingleNode(id);
  }

  function selectEdgeFromGraph(edgeId: string) {
    setInspectorMode("normal");
    setSelectedEdgeId(edgeId);
    setSelectedNodeId("");
    setSelectedNodeIds([]);
    setInspectorOpen(true);
  }

  function selectEdgeFromInspector(edgeId: string) {
    setInspectorMode("normal");
    setSelectedEdgeId(edgeId);
    setInspectorOpen(true);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (e.defaultPrevented) return;
      if (isTypingTarget(e.target)) return;

      if (inspectorOpen) {
        e.preventDefault();
        setInspectorOpen(false);
        setInspectorMode("normal");
        return;
      }

      if (sidebarExpanded) {
        e.preventDefault();
        setActiveTool(null);
        setSidebarExpanded(false);
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown, false);
    return () => window.removeEventListener("keydown", onKeyDown, false);
  }, [inspectorOpen, sidebarExpanded]);

  async function handleLogin(username: string, password: string) {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const u = await loginLocal(username, password);
      setMe(u);
      setLoginOpen(false);
    } catch (e: unknown) {
      setAuthError(e instanceof Error ? e.message : "Inloggning misslyckades");
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleLogout() {
    await logoutLocal();
    setMe(null);
  }

  const effectiveLoginOpen = loginOpen || !me;

  return (
    <div className="app-shell">
      <Sidebar
        refreshToken={refreshSeq}
        nodes={nodes}
        links={links}
        schema={schema}
        selectedNodeId={selectedNodeId || null}
        selectedNodeIds={selectedNodeIds}
        selectedEdgeId={selectedEdgeId || null}
        highlight={normalizedHighlight}
        datatrafik={datatrafik}
        datatrafikLegend={datatrafikLegend}
        activeTool={activeTool}
        expanded={sidebarExpanded}
        onExpandedChange={(v: boolean) => setSidebarExpanded(v)}
        onToolChange={(k: SidebarToolKey) => {
          setActiveTool(k);
          setSidebarExpanded(true);
        }}
        onCloseTool={() => {
          setActiveTool(null);
        }}
        onOpenInspector={(mode?: "normal" | "review") => {
          setInspectorMode(mode === "review" ? "review" : "normal");
          setInspectorOpen(true);
        }}
        onHighlight={setHighlight}
        onError={onError}
        onRefresh={() => refreshGraph({ includeReview: datatrafik.showProposals })}
        onSelectNode={(id: string) => selectSingleNode(id)}
        onSelectEdge={(id: string) => selectEdgeFromGraph(id)}
        onDatatrafikChange={setDatatrafik}
        onDatatrafikLegendChange={setDatatrafikLegend}
        onOpenCreateNode={() => setCreateNodeOpen(true)}
        me={me}
        onLogin={() => setLoginOpen(true)}
        onLogout={() => {
          handleLogout().catch(() => {});
        }}
      />

      <div className="app-main">
        <ErrorModal open={Boolean(error)} message={error ?? ""} onClose={() => setError(null)} />

        <CreateNodeModal
          open={createNodeOpen}
          onClose={() => setCreateNodeOpen(false)}
          onError={onError}
          onCreated={(id: string) => {
            selectSingleNode(id);
          }}
          onRefresh={() => refreshGraph({ includeReview: datatrafik.showProposals })}
        />

        <GraphView
          ref={graphRef}
          inspectorOpen={inspectorOpen}
          nodes={nodes}
          links={links}
          selectedNodeId={selectedNodeId || null}
          selectedNodeIds={selectedNodeIdSet}
          selectedEdgeId={selectedEdgeId || null}
          onSelectNode={(id: string, e?: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean }) => {
            const toggle = !!(e?.metaKey || e?.ctrlKey);
            const add = !!e?.shiftKey;
            selectNodeWithOpts(id, toggle ? { toggle: true } : add ? { add: true } : undefined);
          }}
          onSelectEdge={(id: string) => selectEdgeFromGraph(id)}
          onClearSelection={clearSelection}
          highlight={normalizedHighlight}
          datatrafik={datatrafik}
          onDatatrafikLegendChange={setDatatrafikLegend}
        />

        <PanelDrawer open={inspectorOpen}>
          <div className="panel-light">
            <InspectorPanel
              refreshToken={refreshSeq}
              me={me}
              nodes={nodes}
              links={links}
              schema={schema}
              selectedNodeId={selectedNodeId || null}
              selectedNodeIds={selectedNodeIds}
              selectedEdgeId={selectedEdgeId || null}
              reviewMode={inspectorMode === "review"}
              onExitReview={() => setInspectorMode("normal")}
              onSelectNode={(id: string) => selectSingleNode(id)}
              onSelectEdge={(id: string) => selectEdgeFromInspector(id)}
              onClose={() => {
                setInspectorOpen(false);
                setInspectorMode("normal");
              }}
              onClear={clearSelection}
              onError={onError}
              onRefresh={() => refreshGraph({ includeReview: datatrafik.showProposals })}
            />
          </div>
        </PanelDrawer>

        <LoginModal open={effectiveLoginOpen} busy={authBusy} error={authError} onLogin={handleLogin} />
      </div>
    </div>
  );
}
