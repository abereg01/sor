import { useEffect, type MutableRefObject } from "react";
import * as d3 from "d3";

import type { DatatrafikFilters } from "@/components/flows/DatatrafikPanel";
import type { TooltipState } from "@/components/graph/FlowTooltip";
import { buildRenderFlows, type RenderFlow } from "@/components/graph/renderFlows";

import type { SimLink } from "@/components/graph/flowGeometry";

export function useRenderFlowsWithTooltip(args: {
  flowsByEdgeId: Map<string, any[]>;
  datatrafik: DatatrafikFilters;
  activeFlowEdgeIds: Set<string>;
  shouldRenderFlows: boolean;
  selectedNodeId?: string | null;
  simEpoch: number;

  simLinksRef: MutableRefObject<SimLink[]>;
  flowSelRef: MutableRefObject<d3.Selection<SVGLineElement, RenderFlow, SVGGElement, unknown> | null>;
  flowHitSelRef: MutableRefObject<d3.Selection<SVGLineElement, RenderFlow, SVGGElement, unknown> | null>;
  flowCacheRef: MutableRefObject<{ key: string; rendered: RenderFlow[] }>;
  categoryNameCacheRef: MutableRefObject<Map<string, string>>;
  containerRef: MutableRefObject<HTMLDivElement | null>;

  setTooltip: (v: TooltipState) => void;
}) {
  const {
    flowsByEdgeId,
    datatrafik,
    activeFlowEdgeIds,
    shouldRenderFlows,
    selectedNodeId,
    simEpoch,
    simLinksRef,
    flowSelRef,
    flowHitSelRef,
    flowCacheRef,
    categoryNameCacheRef,
    containerRef,
    setTooltip,
  } = args;

  useEffect(() => {
    const flowSel = flowSelRef.current;
    const flowHitSel = flowHitSelRef.current;
    const containerEl = containerRef.current;
    if (!flowSel || !flowHitSel || !containerEl) return;

    setTooltip({ visible: false });

    const simLinks = simLinksRef.current ?? [];
    const cache = categoryNameCacheRef.current;

    flowHitSel.on("mousemove", null).on("mouseleave", null);

    const idsKey = Array.from(activeFlowEdgeIds).sort().join(",");
    const datKey = JSON.stringify({
      showProposals: Boolean(datatrafik.showProposals),
      showUncategorized: (datatrafik as any).showUncategorized ?? null,
      onlyCategoryIds: (datatrafik as any).onlyCategoryIds ?? null,
      protocol: (datatrafik as any).protocol ?? null,
      frequency: (datatrafik as any).frequency ?? null,
      flowType: (datatrafik as any).flowType ?? null,
    });

    const focusNodeId = selectedNodeId ? String(selectedNodeId) : null;

    const flowsKey = (() => {
      const ids = Array.from(activeFlowEdgeIds).sort();
      const parts: string[] = [];
      for (const id of ids) {
        const fs = (flowsByEdgeId.get(id) ?? []) as any[];
        const fp = fs
          .map((f, idx) => {
            const dir = f?.direction != null ? String(f.direction) : "";
            const typ = f?.flow_type != null ? String(f.flow_type) : "";
            const rev = f?.__review ? "r" : "t";
            const fid = f?.id ? String(f.id) : String(idx);
            return `${fid}:${typ}:${dir}:${rev}`;
          })
          .join(",");
        parts.push(`${id}=[${fp}]`);
      }
      return parts.join("|");
    })();

    const key = `${shouldRenderFlows ? "1" : "0"}|${idsKey}|${datKey}|${focusNodeId ?? ""}|${flowsKey}|sim:${simEpoch}`;

    if (!shouldRenderFlows) {
      flowSelRef.current = flowSel.data([], (d: any) => d.id).join(
        (enter) => enter,
        (update) => update,
        (exit) => exit.remove()
      ) as any;

      flowHitSelRef.current = flowHitSel.data([], (d: any) => d.id).join(
        (enter) => enter,
        (update) => update,
        (exit) => exit.remove()
      ) as any;

      flowCacheRef.current = { key, rendered: [] };
      return;
    }

    let rendered: RenderFlow[] = [];
    if (flowCacheRef.current.key === key) rendered = flowCacheRef.current.rendered;
    else {
      rendered = buildRenderFlows({
        simLinks,
        flowsByEdgeId,
        datatrafik,
        activeFlowEdgeIds,
        categoryNameCache: cache,
        focusNodeId,
      });
      flowCacheRef.current = { key, rendered };
    }

    flowSelRef.current = flowSel
      .data(rendered, (d) => d.id)
      .join((enter) => enter.append("line"), (update) => update, (exit) => exit.remove())
      .attr("stroke", (d) => (d as any).paint ?? d.stroke)
      .attr("stroke-width", (d) => (d.isReview ? 2.4 : 3.2))
      .attr("stroke-opacity", (d) => (d.isReview ? 0.55 : 0.96))
      .attr("stroke-dasharray", (d) => d.dash)
      .attr("stroke-dashoffset", (d) => (d as any).dashOffset ?? 0)
      .style("animation", (d) => {
        const k = d.dir === "reverse" ? "flowDashMoveRev" : "flowDashMoveFwd";
        return `${k} ${d.dur} linear infinite`;
      })
      .style("vector-effect", "non-scaling-stroke") as any;

    flowHitSelRef.current = flowHitSel
      .data(rendered, (d) => d.id)
      .join((enter) => enter.append("line"), (update) => update, (exit) => exit.remove())
      .style("vector-effect", "non-scaling-stroke")
      .on("mousemove", (event: any, d: RenderFlow) => {
        const cr = containerEl.getBoundingClientRect();
        const x = event.clientX - cr.left;
        const y = event.clientY - cr.top;

        const flowType = String(d.flow?.flow_type ?? "");
        const protocol = d.flow?.protocol ? String(d.flow.protocol) : null;
        const frequency = d.flow?.frequency ? String(d.flow.frequency) : null;
        const note = d.flow?.note ? String(d.flow.note) : d.flow?.notes ? String(d.flow.notes) : null;
        const rawDir = d.flow?.direction != null ? String(d.flow.direction) : "";

        const lines: string[] = [];
        lines.push(d.isReview ? "Status: Förslag (needs review)" : "Status: Publicerad sanning");
        lines.push(`Kategori: ${d.catName}`);
        lines.push(`Riktning: ${d.dir === "reverse" ? "Inkommande" : "Utgående"}`);
        if (rawDir) lines.push(`Riktning (raw): ${rawDir}`);
        if (protocol) lines.push(`Protokoll: ${protocol}`);
        if (frequency) lines.push(`Frekvens: ${frequency}`);
        if (note) lines.push(`Not: ${note}`);

        setTooltip({
          visible: true,
          x: Math.min(Math.max(10, x + 14), cr.width - 10),
          y: Math.min(Math.max(10, y + 14), cr.height - 10),
          title: d.isReview ? `Förslag: ${flowType || "Flöde"}` : flowType || "Flöde",
          lines,
          color: d.stroke,
        });
      })
      .on("mouseleave", () => setTooltip({ visible: false })) as any;
  }, [
    flowsByEdgeId,
    datatrafik,
    activeFlowEdgeIds,
    shouldRenderFlows,
    selectedNodeId,
    simEpoch,
    simLinksRef,
    flowSelRef,
    flowHitSelRef,
    flowCacheRef,
    categoryNameCacheRef,
    containerRef,
    setTooltip,
  ]);
}
