export function yesNo(v: any) {
  return v ? "Ja" : "Nej";
}

export function yesNoValueClass(v: any) {
  return v ? "text-emerald-600" : "text-zinc-500";
}

export function textOrDash(v: any) {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s.length ? s : "—";
}

export function envLabelSv(v: any) {
  const s = String(v ?? "").toLowerCase();
  if (!s) return "—";
  if (s === "prod" || s === "production") return "Produktion";
  if (s === "dev" || s === "development") return "Utveckling";
  if (s === "test" || s === "staging") return "Test";
  return textOrDash(v);
}

export function envValueClass(v: any) {
  const s = String(v ?? "").toLowerCase();
  if (s === "prod" || s === "production") return "text-red-600";
  if (s === "test" || s === "staging") return "text-amber-600";
  if (s === "dev" || s === "development") return "text-sky-600";
  return "text-zinc-700";
}

export function slaValueClass(v: any) {
  return v ? "text-emerald-600" : "text-zinc-500";
}

export function criticalValueContent(v: any) {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return yesNo(v);
  const s = String(v ?? "").trim();
  return s.length ? s : "—";
}
