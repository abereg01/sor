import type { GraphLink } from "@/api/types";
import type * as d3 from "d3";

export type SimNode = d3.SimulationNodeDatum & { id: string; x?: number | null; y?: number | null };
export type SimLink = (d3.SimulationLinkDatum<SimNode> & GraphLink) & { source: SimNode; target: SimNode };

export type FlowLineDir = "forward" | "reverse";

export function computeFlowLine(
  edge: SimLink,
  dir: FlowLineDir,
  laneIndex: number,
  laneCount: number,
  laneSpacing = 10,
  trim = 12
) {
  const x1 = edge.source.x ?? 0;
  const y1 = edge.source.y ?? 0;
  const x2 = edge.target.x ?? 0;
  const y2 = edge.target.y ?? 0;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));

  const nx = -dy / len;
  const ny = dx / len;

  const offset = (laneIndex - (laneCount - 1) / 2) * laneSpacing;
  const ox = nx * offset;
  const oy = ny * offset;

  const tx = (dx / len) * trim;
  const ty = (dy / len) * trim;

  let ax1 = x1 + tx + ox;
  let ay1 = y1 + ty + oy;
  let ax2 = x2 - tx + ox;
  let ay2 = y2 - ty + oy;

  if (dir === "reverse") {
    [ax1, ax2] = [ax2, ax1];
    [ay1, ay2] = [ay2, ay1];
  }

  return { x1: ax1, y1: ay1, x2: ax2, y2: ay2 };
}
