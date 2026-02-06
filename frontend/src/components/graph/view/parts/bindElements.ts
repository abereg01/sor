import * as d3 from "d3";

export function bindGraphElements({
  root,
  simNodes,
  simLinks,
  color,
  zoomKRef,
  onSelectNode,
  onSelectEdge,
}: {
  root: d3.Selection<SVGGElement, unknown, null, undefined>;
  simNodes: any[];
  simLinks: any[];
  color: (kind: string) => string;
  zoomKRef: { current: number };
  onSelectNode: (id: string, event: any) => void;
  onSelectEdge: (id: string) => void;
}) {
  const linkSel = root
    .append("g")
    .attr("class", "links")
    .attr("stroke", "rgba(var(--rgb-black),0.30)")
    .attr("stroke-opacity", 0.55)
    .selectAll("line")
    .data(simLinks, (d: any) => d.id)
    .join("line")
    .attr("stroke-width", 1.5)
    .style("cursor", "pointer")
    .style("vector-effect", "non-scaling-stroke");

  const EDGE_HIT_WIDTH = 16;

  const linkHitSel = root
    .append("g")
    .attr("class", "links-hit")
    .selectAll("line")
    .data(simLinks, (d: any) => d.id)
    .join("line")
    .attr("stroke", "rgba(var(--rgb-black),0)")
    .attr("stroke-width", EDGE_HIT_WIDTH)
    .style("cursor", "pointer")
    .style("pointer-events", "stroke")
    .style("vector-effect", "non-scaling-stroke")
    .on("click", (event, d: any) => {
      (event as any).stopPropagation?.();
      onSelectEdge(d.id);
    });

  const flowLayer = root.append("g").attr("class", "flows");

  const flowSel = flowLayer
    .append("g")
    .attr("class", "flow-lines")
    .selectAll<SVGLineElement, any>("line")
    .data([], (d: any) => d.id)
    .join("line")
    .attr("stroke-width", 3)
    .attr("stroke-linecap", "round")
    .style("pointer-events", "none")
    .style("vector-effect", "non-scaling-stroke")
    .attr("filter", "url(#flowShadow)");

  const FLOW_HIT_WIDTH = 18;

  const flowHitSel = flowLayer
    .append("g")
    .attr("class", "flow-hit")
    .selectAll<SVGLineElement, any>("line")
    .data([], (d: any) => d.id)
    .join("line")
    .attr("stroke", "rgba(var(--rgb-black),0)")
    .attr("stroke-width", FLOW_HIT_WIDTH)
    .style("cursor", "help")
    .style("pointer-events", "stroke")
    .style("vector-effect", "non-scaling-stroke");

  const nodeSel = root
    .append("g")
    .attr("class", "nodes")
    .selectAll("circle")
    .data(simNodes, (d: any) => d.id)
    .join("circle")
    .attr("r", 6)
    .attr("fill", (d: any) => color(d.kind ?? "default") as any)
    .attr("stroke", "rgba(var(--rgb-black),0.45)")
    .attr("stroke-width", 1.5)
    .style("cursor", "pointer")
    .attr("filter", "url(#nodeShadow)")
    .on("click", (event, d: any) => {
      (event as any).stopPropagation?.();
      onSelectNode(d.id, event as any);
    });

  const labelLayer = root.append("g").attr("class", "labels");

  const haloSel = labelLayer
    .append("g")
    .attr("class", "labels-halo")
    .selectAll("text")
    .data(simNodes, (d: any) => d.id)
    .join("text")
    .text((d: any) => d.name)
    .attr("font-size", 12)
    .attr("fill", "none")
    .attr("stroke", "rgba(var(--rgb-white),0.92)")
    .attr("stroke-linejoin", "round")
    .attr("stroke-linecap", "round")
    .attr("stroke-width", Math.max(1.2, 3.6 / Math.max(0.6, zoomKRef.current)) as any)
    .attr("pointer-events", "none")
    .attr("text-anchor", "start")
    .attr("dy", -10);

  const labelSel = labelLayer
    .append("g")
    .attr("class", "labels-text")
    .selectAll("text")
    .data(simNodes, (d: any) => d.id)
    .join("text")
    .text((d: any) => d.name)
    .attr("font-size", 12)
    .attr("fill", "var(--panel-text-2)")
    .attr("pointer-events", "none")
    .attr("text-anchor", "start")
    .attr("dy", -10);

  return { linkSel, linkHitSel, nodeSel, labelSel, haloSel, flowSel, flowHitSel };
}
