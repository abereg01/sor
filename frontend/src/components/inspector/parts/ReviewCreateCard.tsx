import type { EdgeClaim } from "@/api/edgeClaims";

export function ReviewCreateCard({
  note,
  onNoteChange,
  onSubmit,
  submitting,
  currentClaim,
}: {
  note: string;
  onNoteChange: (v: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  currentClaim: EdgeClaim | null;
}) {
  return (
    <div className="card-light">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Skapa granskning</div>
        <button onClick={onSubmit} disabled={submitting} style={{ padding: "8px 10px" }}>
          Skicka till granskning
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400 }}>Beskrivning</div>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Skriv en kort beskrivning av vad som ska granskas…"
        />
        <div style={{ fontSize: 12, opacity: 0.65 }}>
          Status sätts till <code>needs_review</code>.
          {currentClaim ? " (Baseras på nuvarande claim)" : " (Skapar en ny claim om ingen finns)"}
        </div>
      </div>
    </div>
  );
}
