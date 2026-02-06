import { useEffect, useMemo, useRef, useState } from "react";
import { searchNodes } from "@/api/client";
import { createEdge as createEdgePayload } from "@/api/edges";
import { createEdgeClaim } from "@/api/edgeClaims";
import type { FlowDirection } from "@/api/types";

type NodeLite = { id: string; name: string; kind: string };

function relationKindOptions(): { value: string; label: string }[] {
  return [
    { value: "depends_on", label: "Beroende av" },
    { value: "runs_on", label: "Körs på" },
    { value: "stores_data", label: "Lagrar data i" },
    { value: "flows_to", label: "Flödar till" },
    { value: "owned_by", label: "Ägs av" },
    { value: "external_dependency", label: "Externt beroende" },
    { value: "backs_up_to", label: "Backar upp till" },
  ];
}

function flowDirectionOptions(): { value: "none" | FlowDirection; label: string }[] {
  return [
    { value: "none", label: "Inget flöde" },
    { value: "source_to_target", label: "Till (Källa → Mål)" },
    { value: "target_to_source", label: "Från (Mål → Källa)" },
    { value: "bidirectional", label: "Dubbelriktad" },
  ];
}

export function InlineConnectBox({
  fromNodeIds,
  onCreated,
  onError,
}: {
  fromNodeIds: string[];
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [kind, setKind] = useState("depends_on");
  const [direction, setDirection] = useState<"none" | FlowDirection>("none");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<NodeLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<NodeLite | null>(null);

  const reqToken = useRef(0);

  const uniqueFromIds = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const raw of fromNodeIds || []) {
      const id = String(raw ?? "").trim();
      if (!id) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  }, [fromNodeIds]);

  const pairMode = uniqueFromIds.length === 2;
  const [pairSwap, setPairSwap] = useState(false);

  const pairFromId = useMemo(() => {
    if (!pairMode) return "";
    const a = uniqueFromIds[0];
    const b = uniqueFromIds[1];
    return pairSwap ? b : a;
  }, [pairMode, uniqueFromIds, pairSwap]);

  const pairToId = useMemo(() => {
    if (!pairMode) return "";
    const a = uniqueFromIds[0];
    const b = uniqueFromIds[1];
    return pairSwap ? a : b;
  }, [pairMode, uniqueFromIds, pairSwap]);

  const canCreate = !!selected && uniqueFromIds.length > 0 && !uniqueFromIds.includes(selected.id);
  const canCreatePair = pairMode && !!pairFromId && !!pairToId && pairFromId !== pairToId;

  const options = useMemo(() => relationKindOptions(), []);
  const dirOptions = useMemo(() => flowDirectionOptions(), []);

  useEffect(() => {
    if (pairMode) {
      setQ("");
      setResults([]);
      setSelected(null);
      setLoading(false);
      return;
    }

    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      setSelected(null);
      setLoading(false);
      return;
    }

    const token = ++reqToken.current;
    setLoading(true);

    const t = window.setTimeout(async () => {
      try {
        const list = await searchNodes(query);
        if (reqToken.current !== token) return;
        setResults(list.slice(0, 8));
      } catch (e: any) {
        if (reqToken.current !== token) return;
        setResults([]);
      } finally {
        if (reqToken.current !== token) return;
        setLoading(false);
      }
    }, 200);

    return () => {
      window.clearTimeout(t);
    };
  }, [q, pairMode]);

  return (
    <div
      style={{
        border: "1px solid var(--panel-subtle-border)",
        background: "var(--panel-subtle-bg)",
        borderRadius: 14,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400 }}>Skapa ny koppling</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400 }}>Relation</div>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400 }}>Flöde</div>
          <select value={direction} onChange={(e) => setDirection(e.target.value as any)}>
            {dirOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400 }}>Mål</div>

          {pairMode ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 500, opacity: 0.92 }}>
                Prefyllt från val (2 noder)
              </div>
              <button onClick={() => setPairSwap((v) => !v)} style={{ padding: "8px 10px" }}>
                Byt riktning
              </button>
            </div>
          ) : (
            <>
              <input placeholder="Sök nod (minst 2 tecken)…" value={q} onChange={(e) => setQ(e.target.value)} />
              {loading ? <div style={{ fontSize: 12, color: "var(--panel-muted)" }}>Söker…</div> : null}
            </>
          )}

          {!pairMode && results.length > 0 ? (
            <div
              style={{
                border: "1px solid var(--panel-border)",
                background: "var(--panel-bg)",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              {results.map((r) => {
                const active = selected?.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 10px",
                      border: "none",
                      background: active ? "var(--info-bg)" : "transparent",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--overlay-strong)", fontWeight: 400, flexShrink: 0 }}>{r.kind}</div>
                  </button>
                );
              })}
            </div>
          ) : null}

          {!pairMode && selected ? (
            <div style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 400 }}>
              Vald: <span style={{ fontWeight: 600 }}>{selected.name}</span>
            </div>
          ) : null}
        </div>

        <button
          disabled={pairMode ? !canCreatePair : !canCreate}
          onClick={async () => {
            try {
              if (pairMode) {
                const edge = await createEdgePayload({
                  from_id: pairFromId,
                  to_id: pairToId,
                  kind,
                });

                if (direction !== "none") {
                  await createEdgeClaim(edge.id, {
                    source: "manuell",
                    confidence: 70,
                    status: "active",
                    flows: [
                      {
                        flow_type: "data",
                        direction,
                      },
                    ],
                  });
                }

                setDirection("none");
                onCreated();
                return;
              }

              if (!selected) return;
              const toId = selected.id;
              const fromIds = uniqueFromIds.filter((id) => id !== toId);
              if (fromIds.length === 0) return;

              let createdCount = 0;
              let lastErr: any = null;

              for (const fromId of fromIds) {
                try {
                  const edge = await createEdgePayload({
                    from_id: fromId,
                    to_id: toId,
                    kind,
                  });

                  createdCount += 1;

                  if (direction !== "none") {
                    await createEdgeClaim(edge.id, {
                      source: "manuell",
                      confidence: 70,
                      status: "active",
                      flows: [
                        {
                          flow_type: "data",
                          direction,
                        },
                      ],
                    });
                  }
                } catch (e: any) {
                  lastErr = e;
                }
              }

              if (createdCount === 0) {
                onError((lastErr as any)?.message ?? "Inga nya kopplingar skapades.");
                return;
              }

              setQ("");
              setResults([]);
              setSelected(null);
              setDirection("none");
              onCreated();
            } catch (e: any) {
              onError(e?.message ?? String(e));
            }
          }}
          style={{ padding: "10px 10px" }}
        >
          {pairMode ? "Lägg till koppling" : uniqueFromIds.length > 1 ? `Lägg till kopplingar (${uniqueFromIds.length})` : "Lägg till koppling"}
        </button>
      </div>
    </div>
  );
}
