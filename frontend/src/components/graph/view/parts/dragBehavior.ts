import * as d3 from "d3";
import type { SimNode } from "@/components/graph/flowGeometry";

export function createNodeDrag(
  simulation: d3.Simulation<SimNode, undefined>
): d3.DragBehavior<SVGCircleElement, SimNode, SimNode | d3.SubjectPosition> {
  function dragStarted(
    event: d3.D3DragEvent<SVGCircleElement, SimNode, SimNode | d3.SubjectPosition>,
    d: SimNode
  ) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(
    event: d3.D3DragEvent<SVGCircleElement, SimNode, SimNode | d3.SubjectPosition>,
    d: SimNode
  ) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragEnded(
    event: d3.D3DragEvent<SVGCircleElement, SimNode, SimNode | d3.SubjectPosition>,
    d: SimNode
  ) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  return d3
    .drag<SVGCircleElement, SimNode>()
    .on("start", dragStarted)
    .on("drag", dragged)
    .on("end", dragEnded);
}
