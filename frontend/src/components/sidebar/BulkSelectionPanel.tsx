import { useMemo, useState } from "react";
import type { GraphLink, GraphNode } from "@/api/types";
import { patchNodeMetadata } from "@/api/client";
import { createEdge } from "@/api/edges";

type Props = {
  selectedNodes: GraphNode[];
  allNodes: GraphNode[];
  links: GraphLink[];
  onRefresh: () => void;
  onError: (msg: string) => void;
  onSelectNode?: (id: string) => void;
};

const RELATIONS = [
  { kind: "depends_on", label: "Beroende av" },
  { kind: "runs_on", label: "Körs på" },
  { kind: "stores_data", label: "Lagrar data i" },
  { kind: "flows_to", label: "Flödar till" },
  { kind: "owned_by", label: "Ägs av" },
  { kind: "external_dependency", label: "Extern beroende" },
];

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function BulkSelectionPanel({ selectedNodes, allNodes, links, onRefresh, onError, onSelectNode }: Props) {
  const [owner, setOwner] = useState<string>("");
  const [vendor, setVendor] = useState<string>("");

  const [targetNodeId, setTargetNodeId] = useState<string>("");
  const [relationKind, setRelationKind] = useState<string>(RELATIONS[0].kind);
  const [busy, setBusy] = useState(false);

  const selectedIds = useMemo(() => new Set(selectedNodes.map((n) => n.id)), [selectedNodes]);

  const candidateTargets = useMemo(() => {
    return allNodes
      .filter((n) => !selectedIds.has(n.id))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allNodes, selectedIds]);

  const existingEdgeKeys = useMemo(() => {
    const set = new Set<string>();
    for (const e of links) set.add(`${e.source}|${e.target}|${e.kind}`);
    return set;
  }, [links]);

  async function applyTags() {
    const patch: Record<string, any> = {};
    if (owner.trim().length) patch.owner = owner.trim();
    if (vendor.trim().length) patch.vendor = vendor.trim();
    if (Object.keys(patch).length === 0) return;

    setBusy(true);
    try {
      for (const n of selectedNodes) {
        await patchNodeMetadata(n.id, n.etag, patch);
      }
      setOwner("");
      setVendor("");
      onRefresh();
    } catch (e) {
      onError((e as any)?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function createEdges() {
    if (!targetNodeId) return;

    setBusy(true);
    try {
      const created: string[] = [];
      for (const n of selectedNodes) {
        const key = `${n.id}|${targetNodeId}|${relationKind}`;
        if (existingEdgeKeys.has(key)) continue;
        await createEdge({ from_id: n.id, to_id: targetNodeId, kind: relationKind });
        created.push(n.id);
      }
      onRefresh();
      if (created.length === 0) {
        onError("Inga nya relationer skapades (fanns redan).");
      } else if (onSelectNode) {
        onSelectNode(created[0]);
      }
    } catch (e) {
      onError((e as any)?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const kindSummary = useMemo(() => uniq(selectedNodes.map((n) => n.kind)).sort(), [selectedNodes]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="surface">
        <div style={{ fontWeight: 600 }}>{selectedNodes.length} valda objekt</div>
        <div style={{ opacity: 0.8, marginTop: 6, fontSize: 13 }}>
          Typer: {kindSummary.map((k) => <code key={k} style={{ marginRight: 6 }}>{k}</code>)}
        </div>
      </div>

      <div className="surface">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Gemensamma taggar</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input className="input" placeholder="owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
          <input className="input" placeholder="vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} />
          <button className="btn-primary" onClick={applyTags} disabled={busy}>
            Sätt taggar på valda
          </button>
        </div>
      </div>

      <div className="surface">
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Skapa flera relationer</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <select className="input" value={relationKind} onChange={(e) => setRelationKind(e.target.value)}>
            {RELATIONS.map((r) => (
              <option key={r.kind} value={r.kind}>
                {r.label} ({r.kind})
              </option>
            ))}
          </select>

          <select className="input" value={targetNodeId} onChange={(e) => setTargetNodeId(e.target.value)}>
            <option value="">Välj mål…</option>
            {candidateTargets.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name} ({n.kind})
              </option>
            ))}
          </select>

          <button className="btn-primary" onClick={createEdges} disabled={busy || !targetNodeId}>
            Skapa relationer
          </button>
        </div>

        <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12 }}>
          Skapar relationer från varje valt objekt → mål. Befintliga relationer hoppas över.
        </div>
      </div>
    </div>
  );
}
