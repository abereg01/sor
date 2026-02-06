import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

import type { EdgeClaimFlow, GraphLink, GraphNode } from "@/api/types";
import type { HighlightState } from "@/lib/highlight";
import type { DatatrafikFilters, DatatrafikLegendItem } from "@/components/flows/DatatrafikPanel";
import { isTypingTarget } from "@/lib/dom";

import { safeId } from "@/components/graph/utils";
import { buildDatatrafikLegend } from "@/components/graph/legend";
import { graphBackgroundCss } from "@/components/graph/background";
import { applySelectionStyles } from "@/components/graph/styles";
import type { RenderFlow } from "@/components/graph/renderFlows";

import { FlowTooltip, type TooltipState } from "@/components/graph/FlowTooltip";
import { CommandPalette, type CommandItem } from "@/components/graph/CommandPalette";

import type { SimLink, SimNode } from "@/components/graph/flowGeometry";

import { QuickFilterControl } from "@/components/graph/view/parts/QuickFilterControl";
import { createNodeDrag } from "@/components/graph/view/parts/dragBehavior";
import { bindGraphElements } from "@/components/graph/view/parts/bindElements";
import { installGraphDefs } from "@/components/graph/view/parts/svgDefs";
import { runTick } from "@/components/graph/view/parts/simulationTick";

import { useGraphMetadataFilters } from "@/components/graph/view/hooks/useGraphMetadataFilters";
import { useApplyQuickFilterDimming } from "@/components/graph/view/hooks/useApplyQuickFilterDimming";
import { useRenderFlowsWithTooltip } from "@/components/graph/view/hooks/useRenderFlowsWithTooltip";

export type GraphViewHandle = {
  zoomToNodes: (nodeIds: string[]) => void;
};

type Props = {
  nodes: GraphNode[];
  links: GraphLink[];

  inspectorOpen?: boolean;
  selectedNodeId?: string | null;
  selectedNodeIds?: Set<string>;
  selectedEdgeId?: string | null;
  onSelectNode: (id: string, event?: { shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean }) => void;
  onClearSelection: () => void;
  onSelectEdge: (id: string) => void;
  highlight: HighlightState;
  datatrafik: DatatrafikFilters;
  onDatatrafikLegendChange: (legend: DatatrafikLegendItem[]) => void;
};

export const GraphView = forwardRef<GraphViewHandle, Props>(function GraphView(
  {
    nodes,
    links,
    inspectorOpen = false,
    selectedNodeId,
    selectedNodeIds,
    selectedEdgeId,
    onSelectNode,
    onClearSelection,
    onSelectEdge,
    highlight,
    datatrafik,
    onDatatrafikLegendChange,
  }: Props,
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [viewportW, setViewportW] = useState(() => (typeof window === "undefined" ? 1200 : window.innerWidth));
  const selectedNodeSet = useMemo(() => selectedNodeIds ?? new Set<string>(), [selectedNodeIds]);

  const rootRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const zoomKRef = useRef(1);

  const simRef = useRef<d3.Simulation<SimNode, undefined> | null>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const simLinksRef = useRef<SimLink[]>([]);

  const nodeSelRef = useRef<d3.Selection<SVGCircleElement, SimNode, SVGGElement, unknown> | null>(null);
  const linkSelRef = useRef<d3.Selection<SVGLineElement, SimLink, SVGGElement, unknown> | null>(null);
  const labelSelRef = useRef<d3.Selection<SVGTextElement, SimNode, SVGGElement, unknown> | null>(null);
  const labelHaloSelRef = useRef<d3.Selection<SVGTextElement, SimNode, SVGGElement, unknown> | null>(null);
  const linkHitSelRef = useRef<d3.Selection<SVGLineElement, SimLink, SVGGElement, unknown> | null>(null);

  const flowSelRef = useRef<d3.Selection<SVGLineElement, any, SVGGElement, unknown> | null>(null);
  const flowHitSelRef = useRef<d3.Selection<SVGLineElement, any, SVGGElement, unknown> | null>(null);
  const flowCacheRef = useRef<{ key: string; rendered: RenderFlow[] }>({ key: "", rendered: [] });

  const [simEpoch, setSimEpoch] = useState(0);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false });

  const categoryNameCacheRef = useRef<Map<string, string>>(new Map());

  const onSelectNodeRef = useRef(onSelectNode);
  const onClearSelectionRef = useRef(onClearSelection);
  const onSelectEdgeRef = useRef(onSelectEdge);

  useEffect(() => {
    onSelectNodeRef.current = onSelectNode;
  }, [onSelectNode]);

  useEffect(() => {
    onClearSelectionRef.current = onClearSelection;
  }, [onClearSelection]);

  useEffect(() => {
    onSelectEdgeRef.current = onSelectEdge;
  }, [onSelectEdge]);

  useEffect(() => {
    function onResize() {
      setViewportW(window.innerWidth);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const quickFilterRight = inspectorOpen ? 12 + 440 + 14 : 14;

  const hasHighlight = useMemo(() => {
    return (highlight.nodeIds.size > 0 || highlight.edgeIds.size > 0) && Boolean(highlight.dimOthers);
  }, [highlight]);

  const nodeSet = useMemo(() => new Set(Array.from(highlight.nodeIds)), [highlight.nodeIds]);
  const edgeSet = useMemo(() => new Set(Array.from(highlight.edgeIds)), [highlight.edgeIds]);

  const flowsByEdgeId = useMemo(() => {
    const map = new Map<string, EdgeClaimFlow[]>();

    for (const l of links) {
      const base = Array.isArray((l as any)?.flows) ? ((l as any).flows as any[]) : [];
      const review = Array.isArray((l as any)?.review_flows) ? ((l as any).review_flows as any[]) : [];

      const merged: any[] = [];
      for (const f of base) merged.push({ ...(f as any), __review: false });

      if (datatrafik.showProposals) {
        for (const f of review) merged.push({ ...(f as any), __review: true });
      }

      map.set(String(l.id), merged as any);
    }

    return map;
  }, [links, datatrafik.showProposals]);

  const visibleCategoryIds = useMemo(() => {
    const ids: string[] = [];
    for (const l of links) {
      const edgeId = String(l.id);
      const flows = (flowsByEdgeId.get(edgeId) ?? []) as any[];
      for (const f of flows) ids.push(f.data_category_id ? String(f.data_category_id) : "__none__");
    }
    return Array.from(new Set(ids));
  }, [links, flowsByEdgeId]);

  useEffect(() => {
    const cache = categoryNameCacheRef.current;

    for (const n of nodes) {
      if ((n.kind || "").toLowerCase() === "data_category") cache.set(n.id, n.name);
    }

    onDatatrafikLegendChange(buildDatatrafikLegend(visibleCategoryIds, cache));
  }, [visibleCategoryIds, nodes, onDatatrafikLegendChange]);

  const activeFlowEdgeIds = useMemo(() => {
    if (selectedEdgeId) return new Set<string>([String(selectedEdgeId)]);

    const ids = new Set<string>();
    const selected = new Set<string>(selectedNodeSet);
    if (selectedNodeId) selected.add(String(selectedNodeId));

    if (selected.size === 0) return ids;

    for (const l of links) {
      const s = safeId((l as any).source);
      const t = safeId((l as any).target);
      if (selected.has(s) || selected.has(t)) ids.add(String(l.id));
    }

    return ids;
  }, [selectedEdgeId, selectedNodeId, selectedNodeSet, links]);

  const shouldRenderFlows = useMemo(() => activeFlowEdgeIds.size > 0, [activeFlowEdgeIds.size]);

  const zoomToNodesInternal = (nodeIds: string[], strength: number) => {
    const svgEl = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!svgEl || !zoomBehavior) return;

    const rect = svgEl.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const simNodes = simNodesRef.current ?? [];
    const pts = simNodes
      .filter((n: any) => nodeIds.includes(n.id))
      .map((n) => ({ x: n.x ?? 0, y: n.y ?? 0 }))
      .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

    if (!pts.length || width <= 0 || height <= 0) return;

    let minX = pts[0].x,
      maxX = pts[0].x,
      minY = pts[0].y,
      maxY = pts[0].y;

    for (const p of pts) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }

    const padding = 420;
    const dx = Math.max(1, maxX - minX);
    const dy = Math.max(1, maxY - minY);

    const raw = 0.92 / Math.max(dx / (width - padding), dy / (height - padding));
    const scaled = raw * strength;

    const scale = Math.max(0.12, Math.min(2.0, scaled));

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const tx = width / 2 - scale * cx;
    const ty = height / 2 - scale * cy;

    d3.select(svgEl)
      .transition()
      .duration(260)
      .call(zoomBehavior.transform as any, d3.zoomIdentity.translate(tx, ty).scale(scale));
  };

  useImperativeHandle(ref, () => ({
    zoomToNodes(nodeIds: string[]) {
      zoomToNodesInternal(nodeIds, 1);
    },
  }));

  const pinnedBySelectionRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const sim = simRef.current;
    const simNodes = simNodesRef.current;
    if (!sim || !simNodes.length) return;

    const desiredPinned = new Set<string>();
    if (selectedNodeId) desiredPinned.add(String(selectedNodeId));

    const pinnedBySelection = pinnedBySelectionRef.current;

    for (const n of simNodes as any[]) {
      const id = String(n.id);

      if (desiredPinned.has(id)) {
        if (!pinnedBySelection.has(id)) {
          n.fx = n.x;
          n.fy = n.y;
          pinnedBySelection.add(id);
        }
      } else if (pinnedBySelection.has(id)) {
        n.fx = null;
        n.fy = null;
        pinnedBySelection.delete(id);
      }
    }
  }, [selectedNodeId]);

  const [paletteOpen, setPaletteOpen] = useState(false);

  const paletteItems: CommandItem[] = useMemo(() => {
    return nodes
      .map((n) => ({
        id: String(n.id),
        title: String(n.name || n.id),
        subtitle: n.kind ? String(n.kind) : null,
      }))
      .sort((a, b) => a.title.localeCompare(b.title, "sv"));
  }, [nodes]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (paletteOpen) return;

      if (e.key === "Escape") {
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        onClearSelectionRef.current();
        return;
      }

      if (e.code === "Space" && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [paletteOpen]);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const { metadataFilters, setMetadataFilters, quickFilterActive, matchesQuickFilters, filterSummary, clearFilters } =
    useGraphMetadataFilters({ nodes, selectedNodeId, selectedNodeSet });

  useApplyQuickFilterDimming({
    quickFilterActive,
    matchesQuickFilters,
    nodeSelRef,
    labelSelRef,
    labelHaloSelRef,
    linkSelRef,
    linkHitSelRef,
    flowSelRef,
    flowHitSelRef,
  });

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);

    const rect0 = svgEl.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect0.width || 960));
    const height = Math.max(1, Math.floor(rect0.height || 600));
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    if (!rootRef.current) {
      svg.selectAll("*").remove();
      installGraphDefs(svg);

      const root = svg.append("g").attr("class", "root");

      const bg = root.append("rect");
      bg.attr("x", -width)
        .attr("y", -height)
        .attr("width", width * 3)
        .attr("height", height * 3)
        .attr("fill", "transparent")
        .style("pointer-events", "all")
        .on("click", () => onClearSelectionRef.current());

      rootRef.current = root;

      const zoom = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 6])
        .on("zoom", (event) => {
          zoomKRef.current = (event.transform as any)?.k ?? 1;

          const k = zoomKRef.current;
          const halo = labelHaloSelRef.current;
          if (halo) {
            const w = Math.max(1.2, 3.6 / Math.max(0.6, k));
            halo.attr("stroke-width", w as any);
          }

          root.attr("transform", event.transform);
        });

      zoomBehaviorRef.current = zoom;
      svg.call(zoom as any);
    }

    simRef.current?.stop();
    simRef.current = null;

    const root = rootRef.current!;
    root.selectAll("*").remove();

    const color = d3.scaleOrdinal(d3.schemeObservable10);

    const simNodes: SimNode[] = nodes.map((n) => ({ ...(n as any) }));
    simNodesRef.current = simNodes;

    const idToNode = new Map(simNodes.map((n: any) => [n.id, n]));

    const simLinks: SimLink[] = links
      .map((l) => {
        const s = idToNode.get(safeId((l as any).source));
        const t = idToNode.get(safeId((l as any).target));
        if (!s || !t) return null as any;
        return { ...(l as any), source: s, target: t } as SimLink;
      })
      .filter(Boolean);

    simLinksRef.current = simLinks;

    const { linkSel, linkHitSel, nodeSel, labelSel, haloSel, flowSel, flowHitSel } = bindGraphElements({
      root,
      simNodes,
      simLinks,
      color: (kind) => color(kind ?? "default") as any,
      zoomKRef,
      onSelectNode: (id, evt) => onSelectNodeRef.current(id, evt),
      onSelectEdge: (id) => onSelectEdgeRef.current(id),
    });

    nodeSelRef.current = nodeSel as any;
    linkSelRef.current = linkSel as any;
    labelSelRef.current = labelSel as any;
    labelHaloSelRef.current = haloSel as any;
    linkHitSelRef.current = linkHitSel as any;
    flowSelRef.current = flowSel as any;
    flowHitSelRef.current = flowHitSel as any;

    const simulation = d3
      .forceSimulation(simNodes)
      .alphaDecay(0.06)
      .force("link", d3.forceLink(simLinks).id((d: any) => d.id).distance(90))
      .force("charge", d3.forceManyBody().strength(-220))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(14));

    simRef.current = simulation;
    setSimEpoch((v) => v + 1);

    nodeSel.call(createNodeDrag(simulation) as any);

    function tick() {
      runTick({
        linkSel: linkSel as any,
        linkHitSel: linkHitSel as any,
        nodeSel: nodeSel as any,
        haloSel: haloSel as any,
        labelSel: labelSel as any,
        flowSel: flowSelRef.current as any,
        flowHitSel: flowHitSelRef.current as any,
      });
    }

    simulation.on("tick", tick);

    return () => {
      simulation.stop();
      simRef.current = null;
    };
  }, [nodes, links, viewportW]);

  useEffect(() => {
    const linkSel = linkSelRef.current;
    const nodeSel = nodeSelRef.current;
    const labelSel = labelSelRef.current;
    if (!linkSel || !nodeSel || !labelSel) return;

    applySelectionStyles({
      linkSel,
      nodeSel,
      labelSel,
      selectedEdgeId,
      selectedNodeId,
      selectedNodeSet,
      hasHighlight,
      nodeSet,
      edgeSet,
    });
  }, [selectedNodeId, selectedNodeSet, selectedEdgeId, hasHighlight, nodeSet, edgeSet]);

  useRenderFlowsWithTooltip({
    containerRef,
    flowSelRef,
    flowHitSelRef,
    flowCacheRef,
    setTooltip,
    simLinksRef,
    categoryNameCacheRef,
    flowsByEdgeId,
    datatrafik,
    activeFlowEdgeIds,
    shouldRenderFlows,
    selectedNodeId,
    simEpoch,
  });

  return (
    <div ref={containerRef} className="graph-root">
      <svg ref={svgRef} className="graph-svg" style={{ "--graph-bg": graphBackgroundCss() } as any} />

      <FlowTooltip tooltip={tooltip} />

      <QuickFilterControl
        rightPx={quickFilterRight}
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        nodes={nodes}
        filters={metadataFilters}
        onChange={setMetadataFilters}
        active={quickFilterActive}
        summary={filterSummary}
        onClear={clearFilters}
      />

      <CommandPalette
        open={paletteOpen}
        items={paletteItems}
        onClose={() => setPaletteOpen(false)}
        onSelect={(id) => {
          setPaletteOpen(false);
          onSelectNodeRef.current(id);
          zoomToNodesInternal([id], 0.18);
        }}
      />
    </div>
  );
});
