import { getAuthToken } from "./client";

export type NodeParty = {
  id: string;
  name: string;
};

export type NodeDetailsNode = {
  id: string;
  kind: string;
  name: string;
  metadata: Record<string, any>;
  owning_department: string | null;
  created_at: string;
  updated_at: string;
};

export type NodeSoftware = {
  software_name: string | null;
  purpose: string | null;
  description: string | null;
};

export type NodeRisk = {
  legal_requirements: boolean | null;
  financial_value: boolean | null;
  pii: boolean | null;
  business_criticality: string | null;
  information_class: string | null;
  criticality_score: number | null;
};

export type NodeDetailsResponse = {
  node: NodeDetailsNode;
  suppliers: NodeParty[];
  supplier_types: string[];
  owners: NodeParty[];
  software: NodeSoftware | null;
  risk: NodeRisk | null;
};

export type LookupItem = {
  id: string;
  name: string;
};

export type PutNodeSoftware = {
  software_name: string | null;
  purpose: string | null;
  description: string | null;
};

export type PutNodeRisk = {
  legal_requirements: boolean | null;
  financial_value: boolean | null;
  pii: boolean | null;
  business_criticality: string | null;
  information_class: string | null;
  criticality_score: number | null;
};

export type PutNodeDetailsRequest = {
  owning_department?: string | null;
  supplier_types?: string[];
  suppliers?: string[];
  owners?: string[];
  metadata?: Record<string, any> | null;
  software?: PutNodeSoftware;
  risk?: PutNodeRisk;
};

function withAuthHeaders(headers?: Record<string, string>): Record<string, string> {
  const token = getAuthToken();
  const out: Record<string, string> = { ...(headers ?? {}) };
  if (token) out["authorization"] = `Bearer ${token}`;
  return out;
}

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...withAuthHeaders(),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const msg = `${res.status} ${res.statusText}${text ? `: ${text}` : ""}`;
    const err: any = new Error(msg);
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function jsonFetchWithEtag<T>(
  path: string,
  init?: RequestInit
): Promise<{ data: T; etag: string | null }> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...withAuthHeaders(),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const msg = `${res.status} ${res.statusText}${text ? `: ${text}` : ""}`;
    const err: any = new Error(msg);
    err.status = res.status;
    throw err;
  }

  const etag = res.headers.get("etag");
  const data = (await res.json()) as T;
  return { data, etag };
}

export function getNodeDetails(nodeId: string): Promise<NodeDetailsResponse> {
  return jsonFetch<NodeDetailsResponse>(`/nodes/${nodeId}/details`);
}

export function getNodeDetailsWithEtag(
  nodeId: string
): Promise<{ data: NodeDetailsResponse; etag: string | null }> {
  return jsonFetchWithEtag<NodeDetailsResponse>(`/nodes/${nodeId}/details`);
}

export async function putNodeDetails(
  nodeId: string,
  patch: PutNodeDetailsRequest,
  opts: { ifMatch: string }
): Promise<{ data: NodeDetailsResponse; etag: string | null }> {
  return jsonFetchWithEtag<NodeDetailsResponse>(`/nodes/${nodeId}/details`, {
    method: "PUT",
    headers: {
      "if-match": opts.ifMatch,
    },
    body: JSON.stringify(patch),
  });
}

export function lookupSuppliers(q: string, limit = 20): Promise<LookupItem[]> {
  const qs = new URLSearchParams();
  if (q.trim()) qs.set("q", q.trim());
  qs.set("limit", String(limit));
  return jsonFetch<LookupItem[]>(`/nodes/lookups/suppliers?${qs.toString()}`);
}

export function lookupOwners(q: string, limit = 20): Promise<LookupItem[]> {
  const qs = new URLSearchParams();
  if (q.trim()) qs.set("q", q.trim());
  qs.set("limit", String(limit));
  return jsonFetch<LookupItem[]>(`/nodes/lookups/owners?${qs.toString()}`);
}
