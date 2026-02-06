import type { AuditLogEntry } from "@/api/audit";

function isTimestampArray(v: any): v is number[] {
  return Array.isArray(v) && v.length >= 6 && v.length <= 9 && v.every((x) => typeof x === "number");
}

function formatTimestampArray(v: number[]) {
  const y = v[0] ?? 0;
  const m = (v[1] ?? 1) - 1;
  const d = v[2] ?? 1;
  const hh = v[3] ?? 0;
  const mm = v[4] ?? 0;
  const ss = v[5] ?? 0;
  const ms = v[6] ?? 0;
  const dt = new Date(Date.UTC(y, m, d, hh, mm, ss, ms));
  if (Number.isNaN(dt.getTime())) return JSON.stringify(v);
  return dt.toLocaleString("sv-SE");
}

function parseAuditDate(at: any): Date | null {
  if (!at) return null;

  if (typeof at === "number" && Number.isFinite(at)) {
    const dt = new Date(at);
    if (!Number.isNaN(dt.getTime())) return dt;
    return null;
  }

  if (typeof at === "string") {
    const s = at.trim();
    if (!s) return null;

    if (/^\d{13,}$/.test(s)) {
      try {
        const bi = BigInt(s);
        const ms = bi > 9999999999999n ? bi / 1000000n : bi;
        const dt = new Date(Number(ms));
        if (!Number.isNaN(dt.getTime())) return dt;
      } catch {
        return null;
      }
    }

    const dt = new Date(s);
    if (!Number.isNaN(dt.getTime())) return dt;
    return null;
  }

  if (isTimestampArray(at)) {
    const y = at[0] ?? 0;
    const m = (at[1] ?? 1) - 1;
    const d = at[2] ?? 1;
    const hh = at[3] ?? 0;
    const mm = at[4] ?? 0;
    const ss = at[5] ?? 0;
    const ms = at[6] ?? 0;
    const dt = new Date(Date.UTC(y, m, d, hh, mm, ss, ms));
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  return null;
}

export function formatAuditAt(at: any) {
  const d = parseAuditDate(at);
  if (!d) return String(at ?? "—");

  const now = new Date();
  const sameYear = now.getFullYear() === d.getFullYear();

  const fmt = new Intl.DateTimeFormat("sv-SE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    ...(sameYear ? {} : { year: "numeric" }),
  });

  return fmt.format(d);
}

export function auditMillis(at: any): number | null {
  const d = parseAuditDate(at);
  if (!d) return null;
  const t = d.getTime();
  if (Number.isNaN(t)) return null;
  return t;
}

export function actorLabelSv(e: AuditLogEntry) {
  const t = (e.actor_type ?? "").toLowerCase();
  if (t === "user") {
    const u = (e.actor_username ?? "").trim();
    const base = u ? u : "(okänd användare)";
    const role = e.actor_role ? ` (${e.actor_role})` : "";
    return `${base}${role}`;
  }
  return "system";
}

export function actionLabelSv(action: string) {
  const a = (action ?? "").toLowerCase();
  if (a === "create") return "Skapad";
  if (a === "patch") return "Ändrad";
  if (a === "delete") return "Raderad";
  return action;
}

function valueSv(v: any): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Ja" : "Nej";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    const s = v.trim();
    return s ? s : "—";
  }
  if (isTimestampArray(v)) return formatTimestampArray(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return "—";
    if (v.every((x) => typeof x === "string")) {
      const xs = (v as string[]).map((x) => x.trim()).filter(Boolean);
      if (xs.length === 0) return "—";
      if (xs.length <= 6) return xs.join(", ");
      return `${xs.slice(0, 6).join(", ")} +${xs.length - 6}`;
    }
    return "(lista)";
  }
  if (typeof v === "object") {
    const name = (v as any).name;
    if (typeof name === "string" && name.trim()) return name.trim();
    return "(objekt)";
  }
  return String(v);
}

function describePrimitiveChange(path: string, before: any, after: any) {
  const b = valueSv(before);
  const a = valueSv(after);
  if (b === a) return null;
  if (before === undefined || before === null) return `${path} lades till: ${a}`;
  if (after === undefined || after === null) return `${path} togs bort (var: ${b})`;
  return `${path} ändrades från ${b} till ${a}`;
}

function shallowDescribeObject(prefix: string, beforeObj: any, afterObj: any, patchObj: any) {
  const out: string[] = [];
  const keys = Object.keys(patchObj ?? {});
  for (const k of keys) {
    const b = beforeObj ? (beforeObj as any)[k] : undefined;
    const a = afterObj ? (afterObj as any)[k] : undefined;
    const line = describePrimitiveChange(`${prefix}.${k}`, b, a);
    if (line) out.push(line);
  }
  return out;
}

export function describeAuditEntry(e: AuditLogEntry): { summary: string; lines: string[] } {
  const action = actionLabelSv(e.action);
  const lines: string[] = [];

  const patch = e.patch;
  if ((e.action ?? "").toLowerCase() === "create") {
    const name = (e.after as any)?.name;
    const kind = (e.after as any)?.kind;
    const bits = [kind ? `(${kind})` : "", name ? `"${name}"` : ""].filter(Boolean).join(" ");
    return { summary: bits ? `${action} ${bits}` : action, lines: [] };
  }

  if ((e.action ?? "").toLowerCase() === "delete") {
    return { summary: "Raderad", lines: [] };
  }

  if (patch && typeof patch === "object" && !Array.isArray(patch)) {
    const keys = Object.keys(patch);
    for (const k of keys) {
      if (k === "metadata" && patch.metadata && typeof patch.metadata === "object" && !Array.isArray(patch.metadata)) {
        lines.push(...shallowDescribeObject("Metadata", (e.before as any)?.metadata, (e.after as any)?.metadata, patch.metadata));
        continue;
      }
      const b = (e.before as any)?.[k];
      const a = (e.after as any)?.[k];
      const line = describePrimitiveChange(k === "name" ? "Namn" : k, b, a);
      if (line) lines.push(line);
    }
  }

  const summary = lines.length > 0 ? `${action} (${lines.length} ändring${lines.length === 1 ? "" : "ar"})` : action;
  return { summary, lines };
}

export function prettyJson(v: any) {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
