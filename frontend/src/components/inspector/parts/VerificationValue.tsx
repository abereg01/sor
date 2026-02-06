import React from "react";
import { Check } from "lucide-react";

export function verifiedStorageKey(kind: "node" | "edge", id: string) {
  return `ux_verified_by:${kind}:${id}`;
}

export function readVerifiedBy(kind: "node" | "edge", id: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    const v = window.localStorage.getItem(verifiedStorageKey(kind, id));
    return v ? v : null;
  } catch {
    return null;
  }
}

export function writeVerifiedBy(kind: "node" | "edge", id: string, username: string) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(verifiedStorageKey(kind, id), username);
  } catch {
  }
}

export function VerificationValue({
  kind,
  id,
  verifiedAt,
  me,
  onVerified,
}: {
  kind: "node" | "edge";
  id: string;
  verifiedAt: any;
  me: { username: string } | null;
  onVerified: () => void;
}) {
  const stored = readVerifiedBy(kind, id);
  const verified = !!(verifiedAt || stored);
  const who = stored || (verified ? me?.username ?? "" : "");

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span style={{ fontWeight: 600, color: verified ? "var(--success)" : "var(--danger)" }}>
          {verified ? `Verifierad av ${who || "—"}` : "Inte verifierad"}
        </span>
      </div>
      <button
        type="button"
        aria-label="Verifiera"
        title="Verifiera"
        onClick={() => {
          const u = me?.username;
          if (!u) return;
          writeVerifiedBy(kind, id, u);
          onVerified();
        }}
        style={{
          padding: "6px 8px",
          border: "1px solid var(--panel-border)",
          background: "var(--panel-bg)",
          borderRadius: 10,
          cursor: me?.username ? "pointer" : "not-allowed",
          opacity: me?.username ? 1 : 0.5,
          color: verified ? "var(--success)" : "var(--danger)",
        }}
      >
        <Check size={14} />
      </button>
    </div>
  );
}
