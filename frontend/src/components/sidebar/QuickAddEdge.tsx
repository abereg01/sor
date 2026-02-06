import { useEffect, useState } from "react";
import { searchNodes, createEdge, NodeSearchResult } from "@/api/client";

export function QuickAddEdge({
  fromNodeId,
  onCreated,
  onError,
}: {
  fromNodeId: string;
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NodeSearchResult[]>([]);
  const [edgeKind, setEdgeKind] = useState("depends_on");

  useEffect(() => {
    if (query.length < 2) return;
    searchNodes(query)
      .then(setResults)
      .catch((e: unknown) => onError(e instanceof Error ? e.message : String(e)));
  }, [query, onError]);

  async function connect(toId: string) {
    try {
      await createEdge(fromNodeId, toId, edgeKind);
      onCreated();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="surface" style={{ marginTop: 12, padding: 12 }}>
      <div style={{ fontWeight: 600 }}>Skapa relation</div>

      <select value={edgeKind} onChange={(e) => setEdgeKind(e.target.value)}>
        <option value="depends_on">beror på</option>
        <option value="flows_to">flödar till</option>
        <option value="stores_data">lagrar data i</option>
      </select>

      <input
        placeholder="Sök objekt…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {results.map((r) => (
        <button
          key={r.id}
          onClick={() => connect(r.id)}
          style={{ width: "100%", textAlign: "left" }}
        >
          {r.name} <code>{r.kind}</code>
        </button>
      ))}
    </div>
  );
}
