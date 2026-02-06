import { getAuthToken } from "./client";
import type { EdgeClaimFlow, FlowDirection } from "./types";

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export type EdgeClaimEvidenceType =
  | "ticket"
  | "url"
  | "contract"
  | "firewall_rule"
  | "document"
  | "other"
  | "note";

export type EdgeClaimEvidence = {
  id: string;
  claim_id: string;
  evidence_type: EdgeClaimEvidenceType;
  reference: string;
  note: string | null;
  created_at: string | number[];
};

export type EdgeClaim = {
  id: string;
  edge_id: string;
  source: string;
  confidence: number;
  status: "active" | "needs_review" | "deprecated";
  created_by: string;
  created_at: string | number[];
  updated_at: string | number[] | null;
  last_verified_at: string | number[] | null;
  evidence: EdgeClaimEvidence[];
  flows: EdgeClaimFlow[];
};

export async function getEdgeClaims(edgeId: string): Promise<EdgeClaim[]> {
  const res = await fetch(`/api/edges/${edgeId}/claims`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Failed to fetch edge claims");
  }

  return res.json();
}

export async function createEdgeClaim(
  edgeId: string,
  payload: {
    source: string;
    confidence: number;
    status: "active" | "needs_review";
    evidence?: Array<{
      evidence_type: EdgeClaimEvidenceType;
      reference: string;
      note?: string | null;
    }>;
    flows?: Array<{
      flow_type: string;
      direction?: FlowDirection;
      data_category_id?: string | null;
      protocol?: string | null;
      frequency?: string | null;
    }>;
  },
): Promise<EdgeClaim> {
  const res = await fetch(`/api/edges/${edgeId}/claims`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Failed to create edge claim");
  }

  return res.json();
}
