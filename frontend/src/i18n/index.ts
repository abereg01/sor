import { sv, type SvDict } from "./sv";

type Path = string;

function get(obj: any, path: Path): any {
  return path.split(".").reduce((acc, k) => (acc && k in acc ? acc[k] : undefined), obj);
}

export function t(key: Path, vars?: Record<string, string | number>): string {
  const raw = get(sv, key);
  const str = typeof raw === "string" ? raw : key;
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export const dict: SvDict = sv;

