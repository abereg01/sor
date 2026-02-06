import { useEffect, useState } from "react";
import type { EdgeClaim } from "@/api/edgeClaims";
import { getEdgeClaims } from "@/api/edgeClaims";

export function EdgeClaimsPanel({
  edgeId,
  onError,
}: {
  edgeId: string;
  onError: (msg: string) => void;
}) {
  const [claims, setClaims] = useState<EdgeClaim[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    getEdgeClaims(edgeId)
      .then((data) => {
        if (!alive) return;
        setClaims(data);
        setLoading(false);
      })
      .catch((e: any) => {
        if (!alive) return;
        onError(e?.message ?? String(e));
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [edgeId, onError]);

  if (loading) {
    return <div style={{ opacity: 0.7 }}>Laddar…</div>;
  }

  if (!claims.length) {
    return <div style={{ opacity: 0.7 }}>Inga påståenden ännu.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {claims.map((c) => (
        <div
          key={c.id}
          style={{
            padding: 12,
            borderRadius: 14,
            border: "1px solid var(--panel-border)",
            background: "var(--panel-bg)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontWeight: 400 }}>{c.source}</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              {c.status} · {Math.round(c.confidence * 100)}%
            </div>
          </div>

          {c.evidence?.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
              Underlag: {c.evidence.length}
            </div>
          )}

          {c.flows?.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
              Flöden: {c.flows.length}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
