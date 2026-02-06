import { useEffect, type MutableRefObject } from "react";
import * as d3 from "d3";

import type { RenderFlow } from "@/components/graph/renderFlows";
import type { SimLink, SimNode } from "@/components/graph/flowGeometry";

export function useApplyQuickFilterDimming(args: {
  quickFilterActive: boolean;
  matchesQuickFilters: Set<string>;

  nodeSelRef: MutableRefObject<d3.Selection<SVGCircleElement, SimNode, SVGGElement, unknown> | null>;
  labelSelRef: MutableRefObject<d3.Selection<SVGTextElement, SimNode, SVGGElement, unknown> | null>;
  labelHaloSelRef: MutableRefObject<d3.Selection<SVGTextElement, SimNode, SVGGElement, unknown> | null>;
  linkSelRef: MutableRefObject<d3.Selection<SVGLineElement, SimLink, SVGGElement, unknown> | null>;
  linkHitSelRef: MutableRefObject<d3.Selection<SVGLineElement, SimLink, SVGGElement, unknown> | null>;
  flowSelRef: MutableRefObject<d3.Selection<SVGLineElement, RenderFlow, SVGGElement, unknown> | null>;
  flowHitSelRef: MutableRefObject<d3.Selection<SVGLineElement, RenderFlow, SVGGElement, unknown> | null>;
}) {
  const {
    quickFilterActive,
    matchesQuickFilters,
    nodeSelRef,
    labelSelRef,
    labelHaloSelRef,
    linkSelRef,
    linkHitSelRef,
    flowSelRef,
    flowHitSelRef,
  } = args;

  useEffect(() => {
    const nodeSel = nodeSelRef.current;
    const labelSel = labelSelRef.current;
    const haloSel = labelHaloSelRef.current;
    const linkSel = linkSelRef.current;
    const linkHitSel = linkHitSelRef.current;
    const flowSel = flowSelRef.current;
    const flowHitSel = flowHitSelRef.current;

    if (!nodeSel || !labelSel || !haloSel || !linkSel || !linkHitSel) return;

    nodeSel.each(function (d: any) {
      const el = d3.select(this as any);
      if ((d as any).__baseFill == null) (d as any).__baseFill = el.attr("fill");
    });

    if (!quickFilterActive) {
      nodeSel.attr("opacity", 1).attr("fill", (d: any) => (d as any).__baseFill ?? null);
      labelSel.attr("opacity", 1);
      haloSel.attr("opacity", 1);
      linkSel.attr("opacity", 1);
      linkHitSel.attr("opacity", 1);
      if (flowSel) flowSel.attr("opacity", 1);
      if (flowHitSel) flowHitSel.attr("opacity", 1);
      return;
    }

    const dimNodeOpacity = 0.18;
    const dimEdgeOpacity = 0.12;

    nodeSel
      .attr("opacity", (d: any) => (matchesQuickFilters.has(String(d.id)) ? 1 : dimNodeOpacity))
      .attr("fill", (d: any) =>
        matchesQuickFilters.has(String(d.id))
          ? (d as any).__baseFill ?? "var(--graph-dim-node-fill)"
          : "var(--graph-dim-node-fill)"
      );

    labelSel.attr("opacity", (d: any) => (matchesQuickFilters.has(String(d.id)) ? 1 : dimNodeOpacity));
    haloSel.attr("opacity", (d: any) => (matchesQuickFilters.has(String(d.id)) ? 1 : dimNodeOpacity));

    linkSel.attr("opacity", (d: any) => {
      const s = String((d as any).source?.id ?? (d as any).source);
      const t = String((d as any).target?.id ?? (d as any).target);
      return matchesQuickFilters.has(s) || matchesQuickFilters.has(t) ? 1 : dimEdgeOpacity;
    });

    linkHitSel.attr("opacity", (d: any) => {
      const s = String((d as any).source?.id ?? (d as any).source);
      const t = String((d as any).target?.id ?? (d as any).target);
      return matchesQuickFilters.has(s) || matchesQuickFilters.has(t) ? 1 : dimEdgeOpacity;
    });

    if (flowSel) {
      flowSel.attr("opacity", (d: any) => {
        const s = String((d as any).edge?.source?.id ?? "");
        const t = String((d as any).edge?.target?.id ?? "");
        return matchesQuickFilters.has(s) || matchesQuickFilters.has(t) ? 1 : dimEdgeOpacity;
      });
    }

    if (flowHitSel) {
      flowHitSel.attr("opacity", (d: any) => {
        const s = String((d as any).edge?.source?.id ?? "");
        const t = String((d as any).edge?.target?.id ?? "");
        return matchesQuickFilters.has(s) || matchesQuickFilters.has(t) ? 1 : dimEdgeOpacity;
      });
    }
  }, [quickFilterActive, matchesQuickFilters, nodeSelRef, labelSelRef, labelHaloSelRef, linkSelRef, linkHitSelRef, flowSelRef, flowHitSelRef]);
}
