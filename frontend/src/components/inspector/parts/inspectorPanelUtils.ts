import type { FlowDirection } from "@/api/types";

export function ifMatchFromUpdatedAt(v: string | number[] | null | undefined): string {
  if (!v) return "";
  if (typeof v === "string") return v.replace(/^\"|\"$/g, "").trim();
  if (!Array.isArray(v)) return "";

  const parts = v.map((x) => Number(x));
  if (parts.length < 6) return "";
  const [y, mo, d, h, mi, s, ns] = parts;

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const base = `${String(y).padStart(4, "0")}-${pad2(mo)}-${pad2(d)}T${pad2(h)}:${pad2(mi)}:${pad2(s)}`;
  const nanos = typeof ns === "number" && ns > 0 ? String(ns).padStart(9, "0").replace(/0+$/, "") : "";
  return nanos ? `${base}.${nanos}Z` : `${base}Z`;
}

export function pickCurrentClaim<T extends { status: string }>(claims: T[]): T | null {
  const active = (claims ?? []).filter((c: any) => c.status === "active");
  if (active.length > 0) return active[0];
  const review = (claims ?? []).filter((c: any) => c.status === "needs_review");
  if (review.length > 0) return review[0];
  const rejected = (claims ?? []).filter((c: any) => c.status === "rejected");
  if (rejected.length > 0) return rejected[0];
  const deprecated = (claims ?? []).filter((c: any) => c.status === "deprecated");
  if (deprecated.length > 0) return deprecated[0];
  return null;
}

export function flowSummaryDir(flows: any[]): FlowDirection {
  const dirs = new Set<string>();
  for (const f of flows ?? []) dirs.add(String(f?.direction ?? "source_to_target"));
  if (dirs.has("bidirectional")) return "bidirectional";
  if (dirs.size > 1) return "bidirectional";
  const only = Array.from(dirs)[0] ?? "source_to_target";
  if (only === "target_to_source") return "target_to_source";
  return "source_to_target";
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function updatedAtToIfMatch(v: any): string {
  if (!v) return "";

  if (typeof v === "string") return v.replace(/^W\//, "").replace(/^\"|\"$/g, "").trim();

  if (Array.isArray(v)) {
    const arr = v as number[];

    if (arr.length >= 3 && arr[1] >= 1 && arr[1] <= 12 && arr[2] >= 1 && arr[2] <= 31) {
      const [y, mo, d, h, mi, s, ns] = arr as number[];
      if (!y || !mo || !d) return "";
      const base = `${y}-${pad2(mo)}-${pad2(d)}T${pad2(h ?? 0)}:${pad2(mi ?? 0)}:${pad2(s ?? 0)}`;
      if (typeof ns === "number" && ns > 0) {
        const frac = String(ns).padStart(9, "0").replace(/0+$/, "");
        return `${base}.${frac}Z`;
      }
      return `${base}Z`;
    }

    if (arr.length >= 6) {
      const [y, ordinal, h, mi, s, ns] = arr as number[];
      if (!y || !ordinal) return "";
      const d0 = new Date(Date.UTC(y, 0, ordinal));
      const mo = d0.getUTCMonth() + 1;
      const d = d0.getUTCDate();
      const base = `${y}-${pad2(mo)}-${pad2(d)}T${pad2(h ?? 0)}:${pad2(mi ?? 0)}:${pad2(s ?? 0)}`;
      if (typeof ns === "number" && ns > 0) {
        const frac = String(ns).padStart(9, "0").replace(/0+$/, "");
        return `${base}.${frac}Z`;
      }
      return `${base}Z`;
    }
  }

  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().replace(/^\"|\"$/g, "").trim();
  } catch {
    return "";
  }
}
