import React, { useState } from "react";
import { createImportBatch } from "@/api/imports";
import { cardStyle, buttonStyle } from "./importStyles";

type Props = {
  onImported: () => void;
  onError: (msg: string) => void;
};

export function ImportSimpleForm({ onImported, onError }: Props) {
  const [source, setSource] = useState<"excel" | "csv">("excel");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function onImport() {
    if (loading) return;
    setLoading(true);
    try {
      await createImportBatch({
        source,
        metadata: note ? { note } : null,
      });
      setNote("");
      onImported();
    } catch (e: any) {
      onError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={cardStyle()}>
      <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 8 }}>
        Importera data
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <select value={source} onChange={(e) => setSource(e.target.value as any)}>
          <option value="excel">📊 Excel</option>
          <option value="csv">🧾 CSV</option>
        </select>

        <textarea
          placeholder="Notering (valfritt)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />

        <button onClick={onImport} disabled={loading}>
          {loading ? "Importerar…" : "Importera"}
        </button>
      </div>
    </div>
  );
}
