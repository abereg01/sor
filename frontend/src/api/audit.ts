import { getAuthToken } from "@/api/client";

export type AuditLogEntry = {
  id: string;
  at: string;
  actor_type: string;
  actor_id: string | null;
  actor_username: string | null;
  actor_role: string | null;
  entity_type: "node" | "edge" | string;
  entity_id: string;
  action: "create" | "patch" | "delete" | string;
  before: any | null;
  patch: any | null;
  after: any | null;
  correlation_id: string | null;
};

function withAuthHeaders(headers?: HeadersInit): HeadersInit {
  const token = getAuthToken();
  const base: Record<string, string> = {};
  if (token) base["authorization"] = `Bearer ${token}`;

  if (!headers) return base;

  if (headers instanceof Headers) {
    const out: Record<string, string> = { ...base };
    headers.forEach((v, k) => (out[k] = v));
    return out;
  }

  if (Array.isArray(headers)) {
    const out: Record<string, string> = { ...base };
    for (const [k, v] of headers) out[k] = v;
    return out;
  }

  return { ...base, ...(headers as Record<string, string>) };
}

async function jsonFetch<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: withAuthHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }

  return (await res.json()) as T;
}

export function fetchNodeAudit(
  nodeId: string,
  opts?: { limit?: number; before?: string },
) {
  const qs = new URLSearchParams();
  if (opts?.limit) qs.set("limit", String(opts.limit));
  if (opts?.before) qs.set("before", opts.before);
  const q = qs.toString();
  return jsonFetch<AuditLogEntry[]>(
    `/audit/node/${nodeId}${q ? `?${q}` : ""}`,
  );
}

export function fetchEdgeAudit(
  edgeId: string,
  opts?: { limit?: number; before?: string },
) {
  const qs = new URLSearchParams();
  if (opts?.limit) qs.set("limit", String(opts.limit));
  if (opts?.before) qs.set("before", opts.before);
  const q = qs.toString();
  return jsonFetch<AuditLogEntry[]>(
    `/audit/edge/${edgeId}${q ? `?${q}` : ""}`,
  );
}

export const getNodeAudit = fetchNodeAudit;
export const getEdgeAudit = fetchEdgeAudit;
