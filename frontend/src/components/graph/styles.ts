import type * as d3 from "d3";
import type { SimLink, SimNode } from "@/components/graph/flowGeometry";

export function applySelectionStyles(args: {
  linkSel: d3.Selection<SVGLineElement, SimLink, SVGGElement, unknown>;
  nodeSel: d3.Selection<SVGCircleElement, SimNode, SVGGElement, unknown>;
  labelSel: d3.Selection<SVGTextElement, SimNode, SVGGElement, unknown>;

  selectedEdgeId?: string | null;
  selectedNodeId?: string | null;
  selectedNodeSet: Set<string>;

  hasHighlight: boolean;
  nodeSet: Set<string>;
  edgeSet: Set<string>;
}) {
  const {
    linkSel,
    nodeSel,
    labelSel,
    selectedEdgeId,
    selectedNodeId,
    selectedNodeSet,
    hasHighlight,
    nodeSet,
    edgeSet,
  } = args;

  const dimOthers = hasHighlight;

  linkSel
    .attr("stroke-width", (d: any) => (d.id === selectedEdgeId ? 3 : 1.5))
    .attr("stroke", (d: any) => {
      if (d.id === selectedEdgeId) return "var(--accent)";
      if (!dimOthers) return "var(--graph-edge)";
      return edgeSet.has(d.id) ? "var(--accent)" : "var(--panel-border-2)";
    })
    .attr("stroke-opacity", 1);

  nodeSel
    .attr("r", (d: any) => (d.id === selectedNodeId ? 9 : selectedNodeSet.has(d.id) ? 8 : 6))
    .attr("opacity", (d: any) => (!dimOthers ? 1 : nodeSet.has(d.id) ? 1 : 0.25))
    .attr(
      "stroke",
      (d: any) =>
        d.id === selectedNodeId || selectedNodeSet.has(d.id) ? "var(--accent)" : "var(--border-strong)"
    )
    .attr("stroke-width", (d: any) => (d.id === selectedNodeId ? 2.5 : selectedNodeSet.has(d.id) ? 2.2 : 1.5));

  labelSel.attr("opacity", (d: any) => (!dimOthers ? 0.9 : nodeSet.has(d.id) ? 0.9 : 0.12));
}
