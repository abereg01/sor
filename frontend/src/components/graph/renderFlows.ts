import type { EdgeClaimFlow } from "@/api/types";
import type { DatatrafikFilters } from "@/components/flows/DatatrafikPanel";
import {
  filterFlows,
  flowDashAnimationDuration,
  flowDashArray,
  normalizeFlowDir,
  normalizeFrequencyClass,
} from "@/components/graph/flow";
import type { SimLink } from "@/components/graph/flowGeometry";

const FLOW_OUT = "var(--accent)";
const FLOW_IN = "var(--success)";

export type RenderFlow = {
  id: string;
  edgeId: string;
  edge: SimLink;
  flow: any;
  dir: "forward" | "reverse";
  laneIndex: number;
  laneCount: number;
  catId: string;
  catName: string;
  stroke: string;
  paint: string;
  dash: string;
  dashOffset: number;
  dur: string;
  isReview: boolean;
};

function safeNodeId(x: any): string {
  return String(x?.id ?? x ?? "");
}

function dashCycleLength(dash: string): number {
  const parts = String(dash)
    .trim()
    .split(/[,\s]+/)
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (!parts.length) return 0;
  return parts.reduce((a, b) => a + b, 0);
}

function strokeFor(args: {
  absDir: "forward" | "reverse";
  edge: SimLink;
  focusNodeId: string | null;
}): string {
  const { absDir, edge, focusNodeId } = args;

  if (!focusNodeId) {
    return absDir === "reverse" ? FLOW_IN : FLOW_OUT;
  }

  const s = safeNodeId((edge as any).source);
  const t = safeNodeId((edge as any).target);
  const from = absDir === "reverse" ? t : s;
  const to = absDir === "reverse" ? s : t;
  const isIncoming = to === focusNodeId;
  return isIncoming ? FLOW_IN : FLOW_OUT;
}

export function buildRenderFlows(args: {
  simLinks: SimLink[];
  flowsByEdgeId: Map<string, EdgeClaimFlow[]>;
  datatrafik: DatatrafikFilters;
  activeFlowEdgeIds: Set<string>;
  categoryNameCache: Map<string, string>;
  focusNodeId?: string | null;
}): RenderFlow[] {
  const { simLinks, flowsByEdgeId, datatrafik, activeFlowEdgeIds, categoryNameCache } = args;
  const focusNodeId = args.focusNodeId ?? null;

  const rendered: RenderFlow[] = [];

  for (const edge of simLinks) {
    const edgeId = String(edge.id);
    if (!activeFlowEdgeIds.has(edgeId)) continue;

    const flowsRaw = flowsByEdgeId.get(edgeId) ?? [];
    const flows = filterFlows(flowsRaw as any, datatrafik) as any[];
    if (!flows.length) continue;

    const laneCount = 1;

    for (let i = 0; i < flows.length; i++) {
      const f: any = flows[i];
      const dir = normalizeFlowDir(f);
      const isReview = Boolean(f.__review);

      const catId = f.data_category_id ? String(f.data_category_id) : "__none__";
      const freqClass = normalizeFrequencyClass(f.frequency);

      const dash = flowDashArray(freqClass);
      const dur = flowDashAnimationDuration(freqClass);
      const cycle = dashCycleLength(dash);
      const halfCycle = cycle > 0 ? cycle / 2 : 0;

      const catName =
        catId === "__none__"
          ? "Okategoriserat"
          : categoryNameCache.get(catId) ?? `Datakategori (${catId.slice(0, 8)}…)`;

      const flowId = String(f?.id ?? "");
      const baseId = flowId && flowId !== "00000000-0000-0000-0000-000000000000" ? flowId : `implicit:${i}`;

      if (dir === "both") {
        const fwdStroke = strokeFor({ absDir: "forward", edge, focusNodeId });
        const revStroke = strokeFor({ absDir: "reverse", edge, focusNodeId });

        rendered.push({
          id: `${edgeId}:${baseId}:forward:${isReview ? "r" : "t"}`,
          edgeId,
          edge,
          flow: f,
          dir: "forward",
          laneIndex: 0,
          laneCount,
          catId,
          catName,
          stroke: fwdStroke,
          paint: fwdStroke,
          dash,
          dashOffset: 0,
          dur,
          isReview,
        });

        rendered.push({
          id: `${edgeId}:${baseId}:reverse:${isReview ? "r" : "t"}`,
          edgeId,
          edge,
          flow: f,
          dir: "reverse",
          laneIndex: 0,
          laneCount,
          catId,
          catName,
          stroke: revStroke,
          paint: revStroke,
          dash,
          dashOffset: halfCycle,
          dur,
          isReview,
        });
      } else {
        const laneDir = dir === "reverse" ? "reverse" : "forward";
        const stroke = strokeFor({ absDir: laneDir, edge, focusNodeId });

        rendered.push({
          id: `${edgeId}:${baseId}:${laneDir}:${isReview ? "r" : "t"}`,
          edgeId,
          edge,
          flow: f,
          dir: laneDir,
          laneIndex: 0,
          laneCount,
          catId,
          catName,
          stroke,
          paint: stroke,
          dash,
          dashOffset: 0,
          dur,
          isReview,
        });
      }
    }
  }

  return rendered;
}
