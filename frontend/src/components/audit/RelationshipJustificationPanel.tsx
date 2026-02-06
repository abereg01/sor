import type { EdgeClaim } from "@/api/edgeClaims";

type Props = {
  edgeId: string;
  fromLabel: string;
  toLabel: string;
  relationLabel: string;
  currentClaim: EdgeClaim | null;
};

function fmtDate(v: any) {
  if (!v) return "—";
  let d: Date | null = null;

  if (v instanceof Date) d = v;
  else if (typeof v === "number") d = new Date(v);
  else if (Array.isArray(v) && typeof v[0] === "number") d = new Date(v[0] * 1000);
  else if (typeof v === "string") {
    const parsed = new Date(v);
    if (!Number.isNaN(parsed.getTime())) d = parsed;
  }

  if (!d) return typeof v === "string" ? v : Array.isArray(v) ? v.join("-") : String(v);

  return d.toLocaleString("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabelSv(status: string) {
  const s = (status ?? "").toLowerCase();
  if (s === "active") return "Aktiv";
  if (s === "needs_review") return "Behöver granskning";
  if (s === "deprecated") return "Utgången";
  return status;
}

function confidenceLabel(v: number) {
  if (typeof v !== "number") return "—";
  if (v >= 90) return `${v}% (starkt)`;
  if (v >= 60) return `${v}% (rimligt)`;
  if (v >= 30) return `${v}% (svagt)`;
  return `${v}% (mycket svagt)`;
}

export function RelationshipJustificationPanel({
  edgeId,
  fromLabel,
  toLabel,
  relationLabel,
  currentClaim,
}: Props) {
  const claim = currentClaim;

  return (
    <div className="card-light">
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Status</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ padding: 10, borderRadius: 14, border: "1px solid var(--panel-border)", background: "var(--panel-subtle-bg)" }}>
          <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400 }}>Status</div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{claim ? statusLabelSv(claim.status) : "—"}</div>
        </div>

        <div style={{ padding: 10, borderRadius: 14, border: "1px solid var(--panel-border)", background: "var(--panel-subtle-bg)" }}>
          <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400 }}>Skapad</div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{claim ? fmtDate(claim.created_at) : "—"}</div>
        </div>
      </div>

      {claim ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>

          {Array.isArray(claim.evidence) && claim.evidence.length > 0 ? (
            <div style={{ marginTop: 2 }}>
              <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400, marginBottom: 6 }}>
                Evidens ({claim.evidence.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {claim.evidence.slice(0, 10).map((ev) => (
                  <div
                    key={ev.id}
                    style={{
                      border: "1px solid var(--panel-border)",
                      borderRadius: 14,
                      padding: 10,
                      background: "var(--panel-subtle-bg)",
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{ev.evidence_type}</div>
                    <div style={{ fontSize: 12, fontWeight: 400, wordBreak: "break-word" }}>{ev.reference}</div>
                    {ev.note ? (
                      <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400, marginTop: 4 }}>{ev.note}</div>
                    ) : null}
                  </div>
                ))}
              </div>
              {claim.evidence.length > 10 ? (
                <div style={{ marginTop: 6, fontSize: 12, color: "var(--panel-muted)", fontWeight: 400 }}>
                  Visar 10 av {claim.evidence.length}.
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400 }}>
              Ingen evidens kopplad till claimen ännu.
            </div>
          )}

          <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400 }}>
            Edge-ID: {edgeId}
          </div>
        </div>
      ) : null}
    </div>
  );
}
