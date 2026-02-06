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

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function updatedAtToIfMatch(v: any): string {
  if (!v) return "";

  if (typeof v === "string") return v.replace(/^W\//, "").replace(/^"|"$/g, "").trim();
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
      const [y, ordinal, h, mi, s, ns, offsetSeconds] = arr as number[];
      if (!y || !ordinal) return "";

      const d0 = new Date(Date.UTC(y, 0, ordinal));
      const mo = d0.getUTCMonth() + 1;
      const d = d0.getUTCDate();

      const base = `${y}-${pad2(mo)}-${pad2(d)}T${pad2(h ?? 0)}:${pad2(mi ?? 0)}:${pad2(s ?? 0)}`;

      const frac =
        typeof ns === "number" && ns > 0 ? String(ns).padStart(9, "0").replace(/0+$/, "") : "";

      const off = typeof offsetSeconds === "number" ? offsetSeconds : 0;
      const sign = off >= 0 ? "+" : "-";
      const abs = Math.abs(off);
      const offH = Math.floor(abs / 3600);
      const offM = Math.floor((abs % 3600) / 60);
      const offStr = off === 0 ? "Z" : `${sign}${pad2(offH)}:${pad2(offM)}`;

      return frac ? `${base}.${frac}${offStr}` : `${base}${offStr}`;
    }
  }

  return "";
}
