import type * as d3 from "d3";

import type { SimLink, SimNode } from "@/components/graph/flowGeometry";
import type { RenderFlow } from "@/components/graph/renderFlows";
import { computeFlowLine } from "@/components/graph/flowGeometry";

export function runTick(args: {
  linkSel: d3.Selection<d3.BaseType, SimLink, SVGGElement, unknown>;
  linkHitSel: d3.Selection<d3.BaseType, SimLink, SVGGElement, unknown>;
  nodeSel: d3.Selection<d3.BaseType, SimNode, SVGGElement, unknown>;
  haloSel: d3.Selection<d3.BaseType, SimNode, SVGGElement, unknown>;
  labelSel: d3.Selection<d3.BaseType, SimNode, SVGGElement, unknown>;
  flowSel: d3.Selection<d3.BaseType, RenderFlow, SVGGElement, unknown> | null;
  flowHitSel: d3.Selection<d3.BaseType, RenderFlow, SVGGElement, unknown> | null;
}) {
  const { linkSel, linkHitSel, nodeSel, haloSel, labelSel, flowSel, flowHitSel } = args;

  linkSel
    .attr("x1", (d: any) => d.source.x as any)
    .attr("y1", (d: any) => d.source.y as any)
    .attr("x2", (d: any) => d.target.x as any)
    .attr("y2", (d: any) => d.target.y as any);

  linkHitSel
    .attr("x1", (d: any) => d.source.x as any)
    .attr("y1", (d: any) => d.source.y as any)
    .attr("x2", (d: any) => d.target.x as any)
    .attr("y2", (d: any) => d.target.y as any);

  nodeSel.attr("cx", (d: any) => d.x as any).attr("cy", (d: any) => d.y as any);

  haloSel.attr("x", (d: any) => (d.x as any) + 10).attr("y", (d: any) => (d.y as any) + 2);
  labelSel.attr("x", (d: any) => (d.x as any) + 10).attr("y", (d: any) => (d.y as any) + 2);

  if (flowSel) {
    flowSel
      .attr("x1", (d) => computeFlowLine(d.edge, d.dir, d.laneIndex, d.laneCount).x1)
      .attr("y1", (d) => computeFlowLine(d.edge, d.dir, d.laneIndex, d.laneCount).y1)
      .attr("x2", (d) => computeFlowLine(d.edge, d.dir, d.laneIndex, d.laneCount).x2)
      .attr("y2", (d) => computeFlowLine(d.edge, d.dir, d.laneIndex, d.laneCount).y2);
  }

  if (flowHitSel) {
    flowHitSel
      .attr("x1", (d) => computeFlowLine(d.edge, d.dir, d.laneIndex, d.laneCount).x1)
      .attr("y1", (d) => computeFlowLine(d.edge, d.dir, d.laneIndex, d.laneCount).y1)
      .attr("x2", (d) => computeFlowLine(d.edge, d.dir, d.laneIndex, d.laneCount).x2)
      .attr("y2", (d) => computeFlowLine(d.edge, d.dir, d.laneIndex, d.laneCount).y2);
  }
}
