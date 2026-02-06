import type {
  BlastRadiusResponse,
  ComplianceResult,
  GraphResponse,
  PathResult,
  SchemaKindsResponse,
} from "./types";

const AUTH_TOKEN_KEY = "ig_auth_token";
const API_BASE = "/api";

/* ------------------------------------------------------------------ */
/* Auth token helpers */
/* ------------------------------------------------------------------ */

export function getAuthToken(): string {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function setAuthToken(token: string) {
  try {
    if (!token) localStorage.removeItem(AUTH_TOKEN_KEY);
    else localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {}
}

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

/* ------------------------------------------------------------------ */
/* Core fetch helpers */
/* ------------------------------------------------------------------ */

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
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

function normalizeIfMatch(etagOrUpdatedAt: string): string {
  let v = (etagOrUpdatedAt ?? "").trim();
  if (!v) return v;

  if (v.startsWith("W/")) v = v.slice(2).trim();
  if (v.startsWith('"') && v.endsWith('"') && v.length >= 2)
    v = v.slice(1, -1);

  return v.trim();
}

/* ------------------------------------------------------------------ */
/* Graph / Query */
/* ------------------------------------------------------------------ */

export function fetchGraph(opts?: { includeReview?: boolean }): Promise<GraphResponse> {
  const includeReview = Boolean(opts?.includeReview);
  const qs = includeReview ? "?include_review=true" : "";
  return jsonFetch(`/graph${qs}`);
}

export function fetchBlastRadius(nodeId: string, depth = 3): Promise<BlastRadiusResponse> {
  return jsonFetch(`/graph/blast-radius/${nodeId}?depth=${depth}`);
}

export function fetchSchemaKinds(): Promise<SchemaKindsResponse> {
  return jsonFetch("/schema/kinds");
}

export function fetchPath(from: string, to: string, maxDepth = 12): Promise<PathResult> {
  const qs = new URLSearchParams({
    from,
    to,
    max_depth: String(maxDepth),
  });
  return jsonFetch(`/query/path?${qs.toString()}`);
}

export function fetchCompliancePII(depth = 6): Promise<ComplianceResult> {
  return jsonFetch(`/query/compliance/pii?depth=${depth}`);
}

/* ------------------------------------------------------------------ */
/* Search */
/* ------------------------------------------------------------------ */

export type NodeSearchResult = {
  id: string;
  name: string;
  kind: string;
};

export function searchNodes(q: string, kind?: string): Promise<NodeSearchResult[]> {
  const qs = new URLSearchParams({ q });
  if (kind) qs.set("kind", kind);
  return jsonFetch(`/search/nodes?${qs.toString()}`);
}

/* ------------------------------------------------------------------ */
/* Nodes */
/* ------------------------------------------------------------------ */

export function duplicateNode(nodeId: string, name: string): Promise<any> {
  return jsonFetch(`/nodes/${nodeId}/duplicate`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function patchNodeMetadata(
  nodeId: string,
  ifMatch: string,
  patch: Record<string, any>
): Promise<any> {
  return jsonFetch(`/nodes/${nodeId}/metadata`, {
    method: "PATCH",
    headers: { "If-Match": normalizeIfMatch(ifMatch) },
    body: JSON.stringify(patch),
  });
}

export async function deleteNode(nodeId: string, ifMatch: string): Promise<void> {
  const res = await fetch(`${API_BASE}/nodes/${nodeId}`, {
    method: "DELETE",
    headers: withAuthHeaders({ "If-Match": normalizeIfMatch(ifMatch) }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }
}

/* ------------------------------------------------------------------ */
/* Edges */
/* ------------------------------------------------------------------ */

export function createEdge(fromId: string, toId: string, kind: string): Promise<void> {
  return jsonFetch("/edges", {
    method: "POST",
    body: JSON.stringify({
      from_id: fromId,
      to_id: toId,
      kind,
    }),
  });
}

export function patchEdgeMetadata(
  edgeId: string,
  ifMatch: string,
  patch: Record<string, any>
): Promise<any> {
  return jsonFetch(`/edges/${edgeId}/metadata`, {
    method: "PATCH",
    headers: { "If-Match": normalizeIfMatch(ifMatch) },
    body: JSON.stringify(patch),
  });
}

export async function deleteEdge(edgeId: string, ifMatch: string): Promise<void> {
  const res = await fetch(`${API_BASE}/edges/${edgeId}`, {
    method: "DELETE",
    headers: withAuthHeaders({ "If-Match": normalizeIfMatch(ifMatch) }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }
}

/* ------------------------------------------------------------------ */
/* Auth */
/* ------------------------------------------------------------------ */

export type AuthMeResponse = {
  username: string;
  role: string;
};

export async function loginLocal(username: string, password: string): Promise<AuthMeResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }

  const data = (await res.json()) as { token: string; user: AuthMeResponse };
  setAuthToken(data.token);
  return data.user;
}

export async function fetchMe(): Promise<AuthMeResponse> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    method: "GET",
    headers: withAuthHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }

  return (await res.json()) as AuthMeResponse;
}

export async function logoutLocal(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    headers: withAuthHeaders(),
  }).catch(() => {});
  setAuthToken("");
}
