import { getAuthToken } from "./client";
import type { NodeClaim } from "./nodeClaims";

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

function normalizeIfMatch(v: string): string {
  const s = (v ?? "").toString().trim();
  return s.replace(/^W\//, "").replace(/^"|"$/g, "").trim();
}

export function approveNodeClaim(
  claimId: string,
  ifMatch: string,
): Promise<{ active_claim: NodeClaim; retired_proposal_id: string }> {
  const v = normalizeIfMatch(ifMatch);
  if (!v) return Promise.reject(new Error("Saknar If-Match (updated_at)"));

  return fetch(`/api/node-claims/${claimId}/approve`, {
    method: "POST",
    headers: { ...authHeaders(), "If-Match": v },
  }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "Failed to approve node claim");
    }
    return res.json();
  });
}

export function rejectNodeClaim(
  claimId: string,
  ifMatch: string,
  reason?: string | null,
): Promise<{ retired_claim: NodeClaim }> {
  const v = normalizeIfMatch(ifMatch);
  if (!v) return Promise.reject(new Error("Saknar If-Match (updated_at)"));

  return fetch(`/api/node-claims/${claimId}/reject`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      "If-Match": v,
    },
    body: JSON.stringify({ reason: reason ?? undefined }),
  }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "Failed to reject node claim");
    }
    return res.json();
  });
}
