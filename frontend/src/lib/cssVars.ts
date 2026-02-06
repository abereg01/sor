let cachedRoot: CSSStyleDeclaration | null = null;

function rootStyle(): CSSStyleDeclaration | null {
  if (cachedRoot) return cachedRoot;
  if (typeof window === "undefined") return null;
  cachedRoot = getComputedStyle(document.documentElement);
  return cachedRoot;
}

export function resetCssVarCache() {
  cachedRoot = null;
}

export function cssVar(name: string, fallback: string): string {
  const s = rootStyle();
  if (!s) return fallback;
  const v = s.getPropertyValue(name).trim();
  return v || fallback;
}

export function cssNumberVar(name: string, fallback: number): number {
  const raw = cssVar(name, "");
  if (!raw) return fallback;
  const n = Number(String(raw).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}
