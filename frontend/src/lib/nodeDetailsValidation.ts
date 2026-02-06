export type Option = { value: string; label: string };

export const OWNING_DEPARTMENT_OPTIONS: Option[] = [
  { value: "el", label: "El" },
  { value: "varme", label: "Värme" },
  { value: "ekonomi", label: "Ekonomi" },
  { value: "digit", label: "Digit" },
  { value: "vatten", label: "Vatten" },
  { value: "stab", label: "Stab" },
  { value: "marknad", label: "Marknad" },
];

export const SUPPLIER_TYPE_VALUES = ["intern", "saas", "paas"] as const;
export type SupplierType = (typeof SUPPLIER_TYPE_VALUES)[number];

export const BUSINESS_CRITICALITY_VALUES = ["low", "medium", "high"] as const;
export type BusinessCriticality = (typeof BUSINESS_CRITICALITY_VALUES)[number];

export const INFORMATION_CLASS_VALUES = ["intern", "begransad", "skyddad", "oppen", "konfidentiell"] as const;
export type InformationClass = (typeof INFORMATION_CLASS_VALUES)[number];

export function deptLabelSv(v: unknown): string {
  if (typeof v !== "string") return "—";
  const s = v.trim().toLowerCase();
  const found = OWNING_DEPARTMENT_OPTIONS.find((o) => o.value === s);
  return found?.label ?? v;
}

export function supplierTypeLabelSv(v: unknown): string {
  if (typeof v !== "string") return "—";
  const s = v.trim().toLowerCase();
  if (s === "intern") return "Intern";
  if (s === "saas") return "SaaS";
  if (s === "paas") return "PaaS";
  return v;
}

export function businessCriticalityLabelSv(v: unknown): string {
  if (typeof v !== "string") return "—";
  const s = v.trim().toLowerCase();
  if (s === "low") return "Låg";
  if (s === "medium") return "Medium";
  if (s === "high") return "Hög";
  return v;
}

export function informationClassLabelSv(v: unknown): string {
  if (typeof v !== "string") return "—";
  const s = v.trim().toLowerCase();
  const map: Record<string, string> = {
    intern: "Intern",
    begransad: "Begränsad",
    skyddad: "Skyddad",
    oppen: "Öppen",
    konfidentiell: "Konfidentiell",
  };
  return map[s] ?? v;
}

export function isValidSupplierType(v: unknown): v is SupplierType {
  if (typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return (SUPPLIER_TYPE_VALUES as readonly string[]).includes(s);
}

export function isValidBusinessCriticality(v: unknown): v is BusinessCriticality {
  if (typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return (BUSINESS_CRITICALITY_VALUES as readonly string[]).includes(s);
}

export function isValidInformationClass(v: unknown): v is InformationClass {
  if (typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return (INFORMATION_CLASS_VALUES as readonly string[]).includes(s);
}

export function trimToNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

export function normalizeList(items: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    if (typeof it !== "string") continue;
    const raw = it.trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
  }
  return out;
}

export function sameStringList(a: unknown[], b: unknown[]): boolean {
  const aa = normalizeList(a).map((s) => s.toLowerCase()).sort();
  const bb = normalizeList(b).map((s) => s.toLowerCase()).sort();
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i++) {
    if (aa[i] !== bb[i]) return false;
  }
  return true;
}

export function validateCriticalityScore(score: unknown): { ok: true; value: number | null } | { ok: false; error: string } {
  if (score === null || score === undefined || score === "") return { ok: true, value: null };
  const n = typeof score === "number" ? score : Number(score);
  if (!Number.isFinite(n)) return { ok: false, error: "Score måste vara ett tal" };
  if (n < 0 || n > 5) return { ok: false, error: "Score måste vara mellan 0 och 5" };
  const stepped = Math.round(n * 2) / 2;
  if (Math.abs(stepped - n) > 1e-9) return { ok: false, error: "Score måste vara i 0.5-steg (0, 0.5, 1.0 ... 5.0)" };
  return { ok: true, value: stepped };
}
