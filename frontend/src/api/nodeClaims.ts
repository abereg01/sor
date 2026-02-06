import { getAuthToken } from "./client";

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export type NodeClaim = {
  id: string;
  node_id: string;
  source: string;
  confidence: number;
  status: "active" | "needs_review" | "deprecated";
  created_by: string;
  created_at: string | number[];
  updated_at: string | number[] | null;
  last_verified_at: string | number[] | null;
};

export async function getNodeClaims(nodeId: string): Promise<NodeClaim[]> {
  const res = await fetch(`/api/nodes/${nodeId}/claims`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Failed to fetch node claims");
  }

  return res.json();
}
