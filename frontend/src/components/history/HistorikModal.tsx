import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import type { GraphLink, GraphNode } from "@/api/types";
import { fetchEdgeAudit, fetchNodeAudit, type AuditLogEntry } from "@/api/audit";
import { listNodes, restoreNode } from "@/api/nodes";
import { actionLabelSv, actorLabelSv, auditMillis, describeAuditEntry, formatAuditAt, prettyJson } from "@/lib/auditHuman";

type Props = {
  open: boolean;
  onClose: () => void;
  nodes: GraphNode[];
  links: GraphLink[];
  onRefresh: () => Promise<void> | void;
  onError: (msg: string) => void;
};

function overlayLayoutStyle() {
  return {
    position: "fixed" as const,
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 20000,
  };
}

function modalLayoutStyle() {
  return {
    width: "min(1080px, calc(100vw - 32px))",
    maxHeight: "calc(100vh - 48px)",
    overflow: "auto" as const,
    borderRadius: 18,
    boxShadow: "0 18px 70px var(--shadow-elev-2)",
    padding: 14,
  };
}

function normalizeId(v: any): string {
  if (typeof v === "string") return v;
  return "";
}

function pLimit(concurrency: number) {
  let activeCount = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    activeCount--;
    const fn = queue.shift();
    if (fn) fn();
  };

  return async function <T>(fn: () => Promise<T>): Promise<T> {
    if (activeCount >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    activeCount++;
    try {
      return await fn();
    } finally {
      next();
    }
  };
}

function isNodeDelete(e: AuditLogEntry) {
  return (e.entity_type ?? "").toLowerCase() === "node" && (e.action ?? "").toLowerCase() === "delete";
}

function actionTextStyle(action: string) {
  const a = (action ?? "").toLowerCase();
  if (a === "create") return { color: "var(--success)" };
  if (a === "patch") return { color: "var(--status-changed)" };
  if (a === "delete") return { color: "var(--danger)" };
  return { color: "var(--panel-text)" };
}

function objectLabelForAudit(e: AuditLogEntry, nodeById: Map<string, GraphNode>, linkById: Map<string, GraphLink>) {
  const t = (e.entity_type ?? "").toLowerCase();
  if (t === "node") {
    const id = normalizeId(e.entity_id);
    const n = nodeById.get(id);
    if (n) return `Nod: ${n.name}`;
    const snapName = (e.before as any)?.name ?? (e.after as any)?.name;
    return snapName ? `Nod: ${snapName}` : "Nod";
  }
  if (t === "edge") {
    const l = linkById.get(normalizeId(e.entity_id));
    if (!l) return "Koppling";
    const a = nodeById.get(l.source)?.name ?? l.source;
    const b = nodeById.get(l.target)?.name ?? l.target;
    return `Koppling: ${a} → ${b}`;
  }
  return e.entity_type;
}

export function HistorikModal({ open, onClose, nodes, links, onRefresh, onError }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AuditLogEntry[]>([]);
  const [expandedRaw, setExpandedRaw] = useState<Record<string, boolean>>({});
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const linkById = useMemo(() => new Map(links.map((l) => [l.id, l])), [links]);

  useEffect(() => {
    if (!open) return;
    setRows([]);
    setExpandedRaw({});
    setRestoringId(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const limit = pLimit(8);
    const nodeIds = nodes.map((n) => n.id);
    const edgeIds = links.map((l) => l.id);

    setLoading(true);

    (async () => {
      try {
        const perEntity = 6;
        const maxEntities = 120;

        let deletedNodeIds: string[] = [];
        try {
          const all = await listNodes({ includeDeleted: true });
          deletedNodeIds = all.filter((n) => n.deleted_at).map((n) => n.id);
        } catch {
          deletedNodeIds = [];
        }

        const mergedNodeIds = Array.from(new Set([...nodeIds, ...deletedNodeIds]));

        const nodeTasks = mergedNodeIds.slice(0, maxEntities).map((id) =>
          limit(async () => {
            try {
              return await fetchNodeAudit(id, { limit: perEntity });
            } catch {
              return [] as AuditLogEntry[];
            }
          })
        );

        const edgeTasks = edgeIds.slice(0, maxEntities).map((id) =>
          limit(async () => {
            try {
              return await fetchEdgeAudit(id, { limit: perEntity });
            } catch {
              return [] as AuditLogEntry[];
            }
          })
        );

        const parts = await Promise.all([...nodeTasks, ...edgeTasks]);
        const merged = parts.flat();

        merged.sort((a, b) => {
          const atA = auditMillis(a.at);
          const atB = auditMillis(b.at);
          if (atA === null && atB === null) return 0;
          if (atA === null) return 1;
          if (atB === null) return -1;
          return atB - atA;
        });

        setRows(merged.slice(0, 250));
      } catch (e: any) {
        onError(e?.message || "Kunde inte hämta historik");
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, nodes, links, onError]);

  async function onRestoreFromAudit(e: AuditLogEntry) {
    const id = normalizeId(e.entity_id);
    if (!id) return;

    const afterAny: any = (e as any).after ?? null;
    const beforeAny: any = (e as any).before ?? null;
    const updatedAtRaw =
      (afterAny?.updated_at ?? afterAny?.updatedAt ?? null) ??
      (beforeAny?.updated_at ?? beforeAny?.updatedAt ?? null);

    const updatedAt = typeof updatedAtRaw === "string" ? updatedAtRaw.replace(/^"|"$/g, "") : null;
    const ifMatch = updatedAt ? `"${updatedAt}"` : null;

    try {
      setRestoringId(id);
      await restoreNode(id, { ifMatch });
      await Promise.resolve(onRefresh());
      onError("Återställde nod");
    } catch (err: any) {
      onError(err?.message || "Kunde inte återställa nod");
    } finally {
      setRestoringId(null);
    }
  }

  if (!open) return null;

  return createPortal(
    <div
      className="modal-overlay"
      style={overlayLayoutStyle()}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-surface panel-light" style={modalLayoutStyle()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>Historik</div>
          <button
            type="button"
            onClick={onClose}
            title="Stäng"
            aria-label="Stäng"
            style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <div style={{ fontSize: 12, color: "var(--panel-text-2)", fontWeight: 400 }}>
            {loading ? "Laddar ändringshistorik…" : rows.length === 0 ? "Ingen historik ännu." : `Visar ${rows.length} senaste händelserna.`}
          </div>

          <div className="card-light" style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "140px 220px 1fr 160px",
                gap: 0,
                padding: "10px 12px",
                borderBottom: "1px solid var(--panel-subtle-border)",
                fontWeight: 600,
                fontSize: 12,
                color: "var(--panel-muted)",
              }}
            >
              <div>Tid</div>
              <div>Aktör</div>
              <div>Objekt</div>
              <div>Händelse</div>
            </div>

            <div style={{ display: "grid" }}>
              {rows.map((e) => {
                const obj = objectLabelForAudit(e, nodeById, linkById);
                const actor = actorLabelSv(e);
                const action = actionLabelSv(e.action);
                const d = describeAuditEntry(e);
                const showRaw = Boolean(expandedRaw[e.id]);
                const actionStyle = actionTextStyle(e.action);

                return (
                  <details key={e.id} style={{ borderBottom: "1px solid var(--panel-subtle-border)" }}>
                    <summary
                      style={{
                        listStyle: "none",
                        cursor: "pointer",
                        display: "grid",
                        gridTemplateColumns: "140px 220px 1fr 160px",
                        gap: 0,
                        padding: "10px 12px",
                        alignItems: "baseline",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      <div style={{ whiteSpace: "nowrap" }} title={String(e.at)}>{formatAuditAt(e.at)}</div>
                      <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{actor}</div>
                      <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{obj}</div>
                      <div style={{ whiteSpace: "nowrap", display: "flex", justifyContent: "flex-start" }}>
                        <span style={{ ...actionStyle, fontSize: 13, fontWeight: 600 }}>{action}</span>
                      </div>
                    </summary>

                    <div style={{ padding: "10px 12px", display: "grid", gap: 10, background: "var(--panel-subtle-bg)" }}>
                      {isNodeDelete(e) ? (
                        <div className="panel-subtle" style={{ padding: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <div style={{ display: "grid", gap: 4 }}>
                            <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 600 }}>Raderad nod</div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{(e.before as any)?.name ?? (e.after as any)?.name ?? "—"}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onRestoreFromAudit(e)}
                            disabled={restoringId === normalizeId(e.entity_id)}
                            className="btn-primary"
                            style={{ fontWeight: 600 }}
                          >
                            {restoringId === normalizeId(e.entity_id) ? "Återställer…" : "Återställ"}
                          </button>
                        </div>
                      ) : null}

                      {d.lines.length > 0 ? (
                        <div className="panel-subtle" style={{ padding: 10 }}>
                          <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 600, marginBottom: 6 }}>
                            Vad ändrades?
                          </div>
                          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
                            {d.lines.map((l, i) => (
                              <li key={`${e.id}_${i}`} style={{ fontSize: 13, fontWeight: 600 }}>
                                {l}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400 }}>
                          Ingen detaljerad diff tillgänglig.
                        </div>
                      )}

                      {isNodeDelete(e) ? (
                        <div>
                          <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 600, marginBottom: 6 }}>Snapshot vid radering</div>
                          <pre style={{ fontSize: 12, overflow: "auto", maxHeight: 320, margin: 0, padding: 10, borderRadius: 12, background: "var(--panel-subtle-bg)" }}>
                            {prettyJson(e.before ?? e.after ?? {})}
                          </pre>
                        </div>
                      ) : null}

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400 }}>
                          {actor} • {action} • {obj}
                        </div>
                        <button
                          type="button"
                          onClick={() => setExpandedRaw((s) => ({ ...s, [e.id]: !Boolean(s[e.id]) }))}
                          style={{ fontSize: 12, fontWeight: 600 }}
                          title="Visa rå JSON"
                          aria-label="DIFF"
                        >
                          DIFF
                        </button>
                      </div>

                      {showRaw ? (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400, marginBottom: 6 }}>Före</div>
                            <pre style={{ fontSize: 12, overflow: "auto", maxHeight: 220, margin: 0, padding: 10, borderRadius: 12, background: "var(--panel-subtle-bg)" }}>
                              {e.before ? prettyJson(e.before) : "—"}
                            </pre>
                          </div>
                          <div>
                            <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400, marginBottom: 6 }}>Efter</div>
                            <pre style={{ fontSize: 12, overflow: "auto", maxHeight: 220, margin: 0, padding: 10, borderRadius: 12, background: "var(--panel-subtle-bg)" }}>
                              {e.after ? prettyJson(e.after) : "—"}
                            </pre>
                          </div>
                          <div style={{ gridColumn: "1 / -1" }}>
                            <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400, marginBottom: 6 }}>Ändring</div>
                            <pre style={{ fontSize: 12, overflow: "auto", maxHeight: 220, margin: 0, padding: 10, borderRadius: 12, background: "var(--panel-subtle-bg)" }}>
                              {e.patch ? prettyJson(e.patch) : "—"}
                            </pre>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
