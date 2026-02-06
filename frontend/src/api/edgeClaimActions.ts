import { getAuthToken } from "./client";
import type { EdgeClaim } from "./edgeClaims";

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

function normalizeIfMatch(v: string): string {
  const s = (v ?? "").toString().trim();
  return s.replace(/^W\//, "").replace(/^"|"$/g, "").trim();
}

export function approveEdgeClaim(
  claimId: string,
  ifMatch: string,
): Promise<{ active_claim: EdgeClaim; retired_proposal_id: string }> {
  const v = normalizeIfMatch(ifMatch);
  if (!v) return Promise.reject(new Error("Saknar If-Match (updated_at)"));

  return fetch(`/api/claims/${claimId}/approve`, {
    method: "POST",
    headers: { ...authHeaders(), "If-Match": v },
  }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "Failed to approve edge claim");
    }
    return res.json();
  });
}

export function rejectEdgeClaim(
  claimId: string,
  ifMatch: string,
  reason?: string | null,
): Promise<{ retired_claim: EdgeClaim }> {
  const v = normalizeIfMatch(ifMatch);
  if (!v) return Promise.reject(new Error("Saknar If-Match (updated_at)"));

  return fetch(`/api/claims/${claimId}/reject`, {
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
      throw new Error(text || "Failed to reject edge claim");
    }
    return res.json();
  });
}
