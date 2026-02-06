import type { GraphLink } from "./types";

type Json = Record<string, any>;

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
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
  if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) v = v.slice(1, -1);

  return v.trim();
}

export function claimIfMatchFromUpdatedAt(updatedAt: unknown): string {
  if (typeof updatedAt === "string" && updatedAt.trim()) return normalizeIfMatch(updatedAt);

  if (Array.isArray(updatedAt) && updatedAt.length >= 1) {
    const sec = Number(updatedAt[0] ?? 0);
    const ms = Number.isFinite(sec) ? sec * 1000 : Date.now();
    return normalizeIfMatch(new Date(ms).toISOString());
  }
  return "";
}

export type ImportBatch = {
  id: string;
  source: string;
  created_by: string;
  started_at: unknown;
  finished_at: unknown | null;
  metadata: Json | null;
};

export type ImportBatchSummary = {
  id: string;
  source: string;
  created_by: string;
  started_at: unknown;
  finished_at: unknown | null;
  metadata: Json | null;
  open_proposals: number;
};

export type EdgeClaim = {
  id: string;
  edge_id: string;
  import_batch_id: string | null;
  source: string;
  confidence: number | null;
  status: "active" | "needs_review" | "retired";
  created_by: string;
  created_at: unknown;
  updated_at: unknown;
  last_verified_at: unknown | null;
};

export type EdgeClaimEvidence = {
  id: string;
  claim_id: string;
  evidence_type: string;
  reference: string;
  note: string | null;
  created_at: unknown;
};

export type EdgeClaimFlow = {
  id: string;
  claim_id: string;
  flow_type: string;
  data_category_id: string | null;
  protocol: string | null;
  frequency: string | null;
  created_at: unknown;
};

export type Edge = {
  id: string;
  from_id: string;
  to_id: string;
  kind: string;
  metadata: Json | null;
  created_at: unknown;
  updated_at: unknown;
};

export type ProposalItem = {
  edge: Edge;
  claim: {
    claim: EdgeClaim;
    evidence: EdgeClaimEvidence[];
    flows: EdgeClaimFlow[];
  };
};

export type NewImportBatch = {
  source: string;
  metadata?: Json | null;
};

export type NewEdgeClaim = {
  source: string;
  confidence?: number | null;
};

export type NewEdgeClaimEvidence = {
  evidence_type: string;
  reference: string;
  note?: string | null;
};

export type NewEdgeClaimFlow = {
  flow_type: string;
  data_category_id?: string | null;
  protocol?: string | null;
  frequency?: string | null;
};

export type ProposalEdgeInput = {
  from_id: string;
  to_id: string;
  kind: string;

  source: string;
  confidence?: number | null;

  evidence?: NewEdgeClaimEvidence[];
  flows?: NewEdgeClaimFlow[];
};

export type CreateProposalsRequest = {
  edges: ProposalEdgeInput[];
};

export function listImportBatches(): Promise<ImportBatchSummary[]> {
  return jsonFetch("/imports");
}

export function createImportBatch(payload: NewImportBatch): Promise<ImportBatch> {
  return jsonFetch("/imports", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function listProposals(batchId: string): Promise<ProposalItem[]> {
  return jsonFetch(`/imports/${batchId}/proposals`);
}

export function createProposals(
  batchId: string,
  payload: CreateProposalsRequest
): Promise<ProposalItem[]> {
  return jsonFetch(`/imports/${batchId}/proposals`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function approveClaim(
  claimId: string,
  ifMatch: string
): Promise<{ active_claim: EdgeClaim; retired_proposal_id: string }> {
  const v = normalizeIfMatch(ifMatch);
  if (!v) return Promise.reject(new Error("Saknar If-Match (updated_at) för claim"));

  return jsonFetch(`/claims/${claimId}/approve`, {
    method: "POST",
    headers: { "If-Match": v },
  });
}

export function rejectClaim(
  claimId: string,
  ifMatch: string,
  reason?: string | null
): Promise<{ retired_claim: EdgeClaim }> {
  const v = normalizeIfMatch(ifMatch);
  if (!v) return Promise.reject(new Error("Saknar If-Match (updated_at) för claim"));

  return jsonFetch(`/claims/${claimId}/reject`, {
    method: "POST",
    headers: { "If-Match": v },
    body: JSON.stringify({ reason: reason ?? undefined }),
  });
}

export function edgeLabelFromGraph(nodesById: Map<string, string>, edge: Edge | GraphLink): string {
  const fromId = (edge as any).from_id ?? (edge as any).source;
  const toId = (edge as any).to_id ?? (edge as any).target;
  const fromName = nodesById.get(String(fromId)) ?? String(fromId).slice(0, 8);
  const toName = nodesById.get(String(toId)) ?? String(toId).slice(0, 8);
  const kind = String((edge as any).kind ?? "");
  return `${kind}: ${fromName} → ${toName}`;
}
