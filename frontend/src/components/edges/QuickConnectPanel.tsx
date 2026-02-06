import { useEffect, useMemo, useState } from "react";
import type { GraphLink, GraphNode } from "@/api/types";
import { createEdge, deleteEdge } from "@/api/edges";

type Props = {
  fromNode: GraphNode;
  allNodes: GraphNode[];
  links: GraphLink[];
  onCreated: () => void;
  onError: (msg: string) => void;
};

const RELATIONS = [
  { kind: "depends_on", label: "Beroende av" },
  { kind: "runs_on", label: "Körs på" },
  { kind: "stores_data", label: "Lagrar data i" },
  { kind: "flows_to", label: "Skickar data till" },
  { kind: "owned_by", label: "Ägs av" },
  { kind: "backs_up_to", label: "Backar upp till" },
  { kind: "external_dependency", label: "Extern beroende" },
];

function relationLabel(kind: string) {
  return RELATIONS.find((r) => r.kind === kind)?.label ?? kind;
}

export function QuickConnectPanel({
  fromNode,
  allNodes,
  links,
  onCreated,
  onError,
}: Props) {
  const [relation, setRelation] = useState("depends_on");
  const [targetId, setTargetId] = useState<string>("");

  useEffect(() => {
    setRelation("depends_on");
    setTargetId("");
  }, [fromNode.id]);

  const nodesById = useMemo(() => {
    const m = new Map<string, GraphNode>();
    for (const n of allNodes) m.set(n.id, n);
    return m;
  }, [allNodes]);

  const targets = useMemo(() => {
    return allNodes.filter((n) => n.id !== fromNode.id);
  }, [allNodes, fromNode.id]);

  const existing = useMemo(() => {
    return links.filter((l: any) => String(l.source) === String(fromNode.id));
  }, [links, fromNode.id]);

  async function submit() {
    if (!targetId) return;

    try {
      await createEdge({
        from_id: fromNode.id,
        to_id: targetId,
        kind: relation,
      });

      onCreated();
      setTargetId("");
    } catch (e: any) {
      onError(e?.message ?? String(e));
    }
  }

  async function removeLink(link: any) {
    try {
      await deleteEdge(link.id, link.etag);
      onCreated();
    } catch (e: any) {
      onError(e?.message ?? String(e));
    }
  }

  function renderTargetName(link: any) {
    const n = nodesById.get(String(link.target));
    if (!n) return String(link.target);
    return `${n.name} (${n.kind})`;
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Koppling</div>

      <div
        style={{
          padding: 12,
          borderRadius: 14,
          border: "1px solid var(--border-subtle)",
          background: "var(--surface)",
          marginBottom: 12,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 8 }}>
          Befintliga kopplingar
        </div>

        {existing.length === 0 ? (
          <div style={{ fontSize: 13, opacity: 0.7 }}>
            Inga kopplingar från detta objekt ännu.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {existing.map((l: any) => (
              <div
                key={l.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid var(--border-subtle)",
                  background: "var(--surface)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {relationLabel(l.kind)}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.78 }}>
                    → {renderTargetName(l)}
                  </div>
                </div>

                <button
                  className="rounded border px-3 py-1 text-sm"
                  onClick={() => removeLink(l)}
                  title="Ta bort denna koppling"
                >
                  Ta bort
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <label className="block text-sm">Relation</label>
      <select
        className="border px-2 py-1 w-full"
        value={relation}
        onChange={(e) => setRelation(e.target.value)}
      >
        {RELATIONS.map((r) => (
          <option key={r.kind} value={r.kind}>
            {r.label}
          </option>
        ))}
      </select>

      <label className="block text-sm" style={{ marginTop: 8 }}>
        Mål
      </label>
      <select
        className="border px-2 py-1 w-full"
        value={targetId}
        onChange={(e) => setTargetId(e.target.value)}
      >
        <option value="">— välj —</option>
        {targets.map((n) => (
          <option key={n.id} value={n.id}>
            {n.name} ({n.kind})
          </option>
        ))}
      </select>

      <button
        className="mt-3 rounded bg-black text-white px-3 py-1 text-sm"
        disabled={!targetId}
        onClick={submit}
      >
        Skapa relation
      </button>
    </div>
  );
}
