import { getAuthToken } from "./client";

export type NewEdgePayload = {
  from_id: string;
  to_id: string;
  kind: string;
};

function authHeader(): Record<string, string> {
  const token = getAuthToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function createEdge(payload: NewEdgePayload) {
  const res = await fetch("/api/edges", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Failed to create edge");
  }

  return res.json();
}

export async function deleteEdge(edgeId: string, ifMatch: string): Promise<void> {
  const res = await fetch(`/api/edges/${edgeId}`, {
    method: "DELETE",
    headers: {
      "If-Match": ifMatch,
      ...authHeader(),
    },
  });

  if (res.status === 204) return;

  const text = await res.text().catch(() => "");
  throw new Error(text || "Kunde inte ta bort relation");
}
