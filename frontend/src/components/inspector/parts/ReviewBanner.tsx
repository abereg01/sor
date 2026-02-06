import React from "react";
import { Check, XCircle } from "lucide-react";

export function ReviewBanner({
  visible,
  claim,
  currentReviewClaim,
  me,
  reviewActionLoading,
  canAct,
  onApprove,
  onReject,
}: {
  visible?: boolean;
  claim?: any;
  currentReviewClaim?: any;
  me: { username: string; role?: string } | null;
  reviewActionLoading: boolean;
  canAct: boolean;
  onApprove: () => void | Promise<void>;
  onReject: () => void | Promise<void>;
}) {
  const c = claim ?? currentReviewClaim;

  const status = String((c as any)?.status ?? "").trim();
  const isRejected = status === "rejected";

  if (visible === false) return null;
  if (!c) return null;

  return (
    <div
      className="panel-subtle"
      style={{
        padding: "10px 12px",
        borderRadius: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.92 }}>
            {isRejected ? "Granskning avslagen" : "Granskning begärd"}
          </div>
          {c?.created_by ? (
            <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 500 }}>Skapad av: {c.created_by}</div>
          ) : null}

          {String((c as any)?.source ?? "").trim() ? (
            <div style={{ fontSize: 12, opacity: 0.82, marginTop: 4, whiteSpace: "pre-wrap" }}>
              {String((c as any).source).trim()}
            </div>
          ) : null}

          {!me?.username ? <div style={{ fontSize: 12, opacity: 0.72 }}>Logga in för att slutföra.</div> : null}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            onClick={() => void onApprove()}
            title="Godkänn"
            aria-label="Godkänn"
            disabled={reviewActionLoading || !me?.username || !canAct}
            style={{ padding: "8px 10px", opacity: reviewActionLoading ? 0.7 : 1 }}
          >
            <Check size={16} />
          </button>

          <button
            onClick={() => void onReject()}
            title="Avslå"
            aria-label="Avslå"
            disabled={reviewActionLoading || !me?.username || !canAct}
            style={{ padding: "8px 10px", opacity: reviewActionLoading ? 0.7 : 1 }}
          >
            <XCircle size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
