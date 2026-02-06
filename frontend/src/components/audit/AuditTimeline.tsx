import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { isTypingTarget } from "@/lib/dom";

import type { AuditLogEntry } from "@/api/audit";
import { actorLabelSv, describeAuditEntry, formatAuditAt, prettyJson } from "@/lib/auditHuman";

type Props = {
  title?: string;
  entityLabel?: string;
  entries: AuditLogEntry[];
  loading?: boolean;
  error?: string | null;
};


function actionVerbSv(action: string) {
  const a = (action ?? "").toLowerCase();
  if (a === "create") return "Skapade";
  if (a === "patch") return "Ändrade";
  if (a === "delete") return "Tog bort";
  return action;
}

export function AuditTimeline({ title, entityLabel, entries, loading, error }: Props) {
  const rows = entries;
  const label = entityLabel ?? "";
  const [diffEntry, setDiffEntry] = useState<AuditLogEntry | null>(null);

  const emptyState = useMemo(() => {
    if (loading) return "Laddar historik…";
    if (error) return error;
    return "Ingen historik ännu.";
  }, [loading, error]);

  useEffect(() => {
    if (!diffEntry) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      setDiffEntry(null);
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [diffEntry]);

  const diffModal = diffEntry
    ? createPortal(
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 95,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDiffEntry(null);
          }}
        >
          <div className="modal-overlay" style={{ position: "absolute", inset: 0 }} />

          <div
            className="panel-light modal-surface"
            role="dialog"
            aria-modal="true"
            style={{
              position: "relative",
              width: "min(1200px, calc(100vw - 32px))",
              maxHeight: "min(78vh, 900px)",
              borderRadius: 14,
              boxShadow: "var(--shadow-soft)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "12px 14px",
                borderBottom: "1px solid var(--panel-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: "var(--accent)",
                    boxShadow: "0 0 0 4px var(--focus-ring)",
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    fontWeight: 600,
                    color: "var(--panel-text)",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    textOverflow: "ellipsis",
                  }}
                >
                  Diff
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDiffEntry(null)}
                title="Stäng"
                aria-label="Stäng"
                style={{
                  width: 40,
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 14, overflow: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400, marginBottom: 6 }}>Före</div>
                  <pre
                    style={{
                      fontSize: 12,
                      overflow: "auto",
                      maxHeight: 420,
                      margin: 0,
                      padding: 10,
                      borderRadius: 12,
                      background: "var(--panel-subtle-bg)",
                    }}
                  >
                    {diffEntry.before ? prettyJson(diffEntry.before) : "—"}
                  </pre>
                </div>

                <div>
                  <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400, marginBottom: 6 }}>Efter</div>
                  <pre
                    style={{
                      fontSize: 12,
                      overflow: "auto",
                      maxHeight: 420,
                      margin: 0,
                      padding: 10,
                      borderRadius: 12,
                      background: "var(--panel-subtle-bg)",
                    }}
                  >
                    {diffEntry.after ? prettyJson(diffEntry.after) : "—"}
                  </pre>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400, marginBottom: 6 }}>Ändring</div>
                  <pre
                    style={{
                      fontSize: 12,
                      overflow: "auto",
                      maxHeight: 420,
                      margin: 0,
                      padding: 10,
                      borderRadius: 12,
                      background: "var(--panel-subtle-bg)",
                    }}
                  >
                    {diffEntry.patch ? prettyJson(diffEntry.patch) : "—"}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="card-light">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{title ?? "Historik"}</div>
        <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400 }}>{label}</div>
      </div>

      {rows.length === 0 ? (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--panel-muted)", fontWeight: 400 }}>{emptyState}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {rows.map((e) => {
            const d = describeAuditEntry(e);
            const actor = actorLabelSv(e);
            const verb = actionVerbSv(e.action);
            const isPatch = (e.action ?? "").toLowerCase() === "patch";
            const verbEl = <span className={isPatch ? "audit-action--patch" : undefined}>{verb}</span>;
            const summaryTail = d.summary && d.summary !== verb ? d.summary : "";

            return (
              <details
                key={e.id}
                style={{
                  border: "1px solid var(--panel-border)",
                  borderRadius: 14,
                  padding: 10,
                  background: "var(--panel-subtle-bg)",
                }}
              >
                <summary
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "baseline",
                    listStyle: "none",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {verbEl} {label}{summaryTail ? ` • ${summaryTail}` : ""}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400, whiteSpace: "nowrap" }}>
                    {formatAuditAt(e.at)} • {actor}
                  </div>
                </summary>

                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                  {d.lines.length > 0 ? (
                    <div className="panel-subtle" style={{ padding: 10 }}>
                      <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 600, marginBottom: 6 }}>Ändringar</div>
                      <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
                        {d.lines.map((l, i) => (
                          <li key={`${e.id}_${i}`} style={{ fontSize: 13, fontWeight: 400 }}>
                            {l}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400 }}>Ingen detaljerad diff tillgänglig.</div>
                  )}

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => setDiffEntry(e)}
                      style={{ fontSize: 12, fontWeight: 500 }}
                    >
                      DIFF
                    </button>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}

      {diffModal}
    </div>
  );
}
