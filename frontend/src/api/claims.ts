import { getAuthToken } from "./client";

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

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: withAuthHeaders({
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/* ------------------------------------------------------------------ */
/* Claims */
/* ------------------------------------------------------------------ */

export type ClaimRow = {
  id: string;
  entity_type: "node" | "edge";
  entity_id: string;
  source: string;
  confidence: number | null;
  status: "active" | "needs_review" | "deprecated";
  created_by: string;
  created_at: unknown;
  updated_at: unknown;
};

export function listClaimsForNode(nodeId: string): Promise<ClaimRow[]> {
  return jsonFetch(`/nodes/${nodeId}/claims`);
}

export function listClaimsForEdge(edgeId: string): Promise<ClaimRow[]> {
  return jsonFetch(`/edges/${edgeId}/claims`);
}
