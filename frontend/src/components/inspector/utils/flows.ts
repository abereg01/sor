import type { FlowDirection } from "@/api/types";

export function pickCurrentClaim<T extends { status: string }>(claims: T[]): T | null {
  const active = (claims ?? []).filter((c: any) => c.status === "active");
  if (active.length > 0) return active[0];
  const review = (claims ?? []).filter((c: any) => c.status === "needs_review");
  if (review.length > 0) return review[0];
  return null;
}

export function flowSummaryDir(flows: any[]): FlowDirection {
  const dirs = new Set<string>();
  for (const f of flows ?? []) dirs.add(String((f as any)?.direction ?? "source_to_target"));
  if (dirs.has("bidirectional")) return "bidirectional";
  if (dirs.size > 1) return "bidirectional";
  const only = Array.from(dirs)[0] ?? "source_to_target";
  if (only === "target_to_source") return "target_to_source";
  return "source_to_target";
}

export function directionLabelSv(d: FlowDirection) {
  if (d === "source_to_target") return "Källa → Mål";
  if (d === "target_to_source") return "Mål → Källa";
  if (d === "bidirectional") return "Dubbelriktad";
  return d;
}
