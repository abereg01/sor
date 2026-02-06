import type { EdgeClaimFlow, FlowDirection } from "@/api/types";
import type { DatatrafikFilters } from "@/components/flows/DatatrafikPanel";

export type FlowDir = "forward" | "reverse" | "both";

export function normalizeFlowDir(flow: { direction?: FlowDirection | string | null } | null | undefined): FlowDir {
  const raw = (flow as any)?.direction;

  if (raw == null) return "forward";

  const s = String(raw).trim().toLowerCase();
  if (!s) return "forward";

  if (s === "source_to_target") return "forward";
  if (s === "target_to_source") return "reverse";
  if (s === "bidirectional") return "both";
  if (s === "source-to-target") return "forward";
  if (s === "target-to-source") return "reverse";
  if (
    s === "forward" ||
    s === "outgoing" ||
    s === "utgående" ||
    s === "from_to" ||
    s === "from-to" ||
    s === "from>to" ||
    s === "from->to" ||
    s === "källa->mål" ||
    s === "kalla->mal"
  ) {
    return "forward";
  }

  if (
    s === "reverse" ||
    s === "incoming" ||
    s === "inkommande" ||
    s === "to_from" ||
    s === "to-from" ||
    s === "to>from" ||
    s === "to->from" ||
    s === "mål->källa" ||
    s === "mal->kalla"
  ) {
    return "reverse";
  }

  if (
    s === "both" ||
    s === "bi" ||
    s === "bidir" ||
    s === "dubbelriktad" ||
    s === "double" ||
    s === "dual"
  ) {
    return "both";
  }

  return "forward";
}

export type FlowFreqClass = "continuous" | "periodic" | "batch" | "unknown";

export function normalizeFrequencyClass(freq: unknown): FlowFreqClass {
  const s = String(freq ?? "").toLowerCase().trim();
  if (!s) return "unknown";

  if (
    s === "continuous" ||
    s === "realtime" ||
    s === "real_time" ||
    s === "stream" ||
    s === "streaming" ||
    s === "event" ||
    s === "event_driven" ||
    s === "near_realtime" ||
    s === "near-real-time"
  ) {
    return "continuous";
  }

  if (s === "batch" || s === "nightly" || s.includes("batch") || s.includes("nightly")) return "batch";

  if (
    s === "periodic" ||
    s === "scheduled" ||
    s === "hourly" ||
    s === "daily" ||
    s === "weekly" ||
    s === "monthly" ||
    s.includes("hour") ||
    s.includes("day") ||
    s.includes("week") ||
    s.includes("month") ||
    s.includes("cron") ||
    s.includes("schedule")
  ) {
    return "periodic";
  }

  return "unknown";
}

export function flowDashArray(_freqClass: FlowFreqClass): string {
  return "8 6";
}

export function flowDashAnimationDuration(freqClass: FlowFreqClass): string {
  switch (freqClass) {
    case "continuous":
      return "1.05s";
    case "periodic":
      return "1.55s";
    case "batch":
      return "2.05s";
    default:
      return "1.75s";
  }
}

export function filterFlows(flows: EdgeClaimFlow[], f: DatatrafikFilters): EdgeClaimFlow[] {
  if (!f.enabled) return flows;

  return flows.filter((flow) => {
    if (f.flowType !== "__all__" && (flow as any).flow_type !== f.flowType) return false;
    if (f.dataCategoryId !== "__all__" && (flow as any).data_category_id !== f.dataCategoryId) return false;

    const dir = normalizeFlowDir(flow as any);
    if (f.direction === "outgoing") return dir === "forward" || dir === "both";
    if (f.direction === "incoming") return dir === "reverse" || dir === "both";
    return true;
  });
}
