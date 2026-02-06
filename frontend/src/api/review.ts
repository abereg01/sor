import { getAuthToken } from "./client";

export type NeedsReviewEdge = {
  edge_id: string;
  kind: string;
  from_id: string;
  to_id: string;
  proposals: number;
  created_by: string;
  created_at: string;
};

export type NeedsReviewNode = {
  node_id: string;
  kind: string;
  name: string;
  proposals: number;
  created_by: string;
  created_at: string;
};

function authHeader(): Record<string, string> {
  const token = getAuthToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function listEdgesNeedingReview(): Promise<NeedsReviewEdge[]> {
  const res = await fetch("/api/edges/needs-review", {
    headers: { ...authHeader() },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Failed to load needs_review queue");
  }
  return (await res.json()) as NeedsReviewEdge[];
}

export async function listNodesNeedingReview(): Promise<NeedsReviewNode[]> {
  const res = await fetch("/api/nodes/needs-review", {
    headers: { ...authHeader() },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Failed to load needs_review queue");
  }
  return (await res.json()) as NeedsReviewNode[];
}

export async function markEdgeNeedsReview(
  edgeId: string,
  description: string,
) {
  const desc = (description ?? "").trim();
  if (!desc) throw new Error("Beskrivning krävs");

  const res = await fetch(`/api/edges/${edgeId}/needs-review`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ description: desc }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Failed to create review request");
  }

  return res.json();
}

export async function markNodeNeedsReview(
  nodeId: string,
  description: string,
) {
  const desc = (description ?? "").trim();
  if (!desc) throw new Error("Beskrivning krävs");

  const res = await fetch(`/api/nodes/${nodeId}/needs-review`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({ description: desc }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Failed to create review request");
  }

  return res.json();
}
