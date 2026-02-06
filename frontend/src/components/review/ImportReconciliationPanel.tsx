import { useEffect, useMemo, useState } from "react";
import type { GraphLink, GraphNode, SchemaKindsResponse } from "@/api/types";
import { listImportBatches, type ImportBatchSummary } from "@/api/imports";
import { ImportPanel } from "@/components/imports/ImportPanel";
import { t } from "@/i18n";

type Props = {
  nodes: GraphNode[];
  links: GraphLink[];
  schema: SchemaKindsResponse | null;
  onRefreshGraph: () => void;
  onError: (msg: string) => void;
  refreshToken?: any;
};

type ModalState =
  | { open: false }
  | {
      open: true;
      batchId: string;
      source: string;
      openProposals: number;
    };

function buttonStyle(kind: "primary" | "ghost" = "primary"): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid var(--border-strong)",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 12,
  };
  if (kind === "ghost") return { ...base, background: "var(--surface)" };
  return { ...base, background: "var(--info-bg)" };
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "var(--overlay-strong)",
        backdropFilter: "blur(6px)",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(980px, 100%)",
          maxHeight: "min(92vh, 980px)",
          overflow: "auto",
          borderRadius: 18,
          border: "1px solid var(--border-strong)",
          background: "var(--bg-app)",
          boxShadow: "0 30px 80px var(--shadow-elev-3)",
          padding: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 1000, fontSize: 14 }}>{title}</div>
          <div style={{ marginLeft: "auto" }}>
            <button onClick={onClose} style={buttonStyle("ghost")}>
              {t("common.close")}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </div>
  );
}

export function ImportReconciliationPanel({ nodes, links, schema, onRefreshGraph, onError, refreshToken }: Props) {
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState<ImportBatchSummary[]>([]);
  const [modal, setModal] = useState<ModalState>({ open: false });

  async function load() {
    setLoading(true);
    try {
      const items = await listImportBatches();
      setBatches(items);
    } catch (e: any) {
      onError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [refreshToken]);

  const openBatches = useMemo(() => batches.filter((b) => (b.open_proposals ?? 0) > 0), [batches]);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontWeight: 600 }}>{t("review.importReconciliation")}</div>
        <div style={{ marginLeft: "auto" }}>
          <button onClick={load} disabled={loading} style={buttonStyle("ghost")}>
            {t("common.refresh")}
          </button>
        </div>
      </div>

      {openBatches.length === 0 ? (
        <div style={{ opacity: 0.7, fontSize: 13 }}>{t("review.noOpenImports")}</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {openBatches.slice(0, 25).map((b) => (
            <button
              key={b.id}
              onClick={() =>
                setModal({
                  open: true,
                  batchId: b.id,
                  source: b.source,
                  openProposals: b.open_proposals ?? 0,
                })
              }
              style={{
                width: "100%",
                textAlign: "left",
                borderRadius: 12,
                border: "1px solid var(--border-strong)",
                padding: "10px 12px",
                background: "var(--surface)",
              }}
            >
              <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                <span>{b.source}</span>
                <span style={{ opacity: 0.75, fontWeight: 600 }}>({b.open_proposals ?? 0})</span>
              </div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                {String(b.created_by || "")} · {String(b.started_at || "")}
              </div>
            </button>
          ))}
        </div>
      )}

      {openBatches.length > 25 && <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>Visar första 25.</div>}

      {modal.open && (
        <Modal
          title={`Import: ${modal.source} · ${modal.openProposals} öppna`}
          onClose={() => {
            setModal({ open: false });
            load();
          }}
        >
          <ImportPanel
            key={modal.batchId}
            nodes={nodes}
            links={links}
            schema={schema}
            onRefreshGraph={onRefreshGraph}
            onError={onError}
          />
        </Modal>
      )}
    </div>
  );
}
