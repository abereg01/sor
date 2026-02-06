import { slaValueClass } from "@/components/inspector/utils/format";
import { nodeById } from "@/components/inspector/utils/nodes";
import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { FlowDirection, GraphLink, GraphNode, SchemaKindsResponse } from "@/api/types";
import { deleteEdge, deleteNode } from "@/api/client";
import { getEdgeClaims, type EdgeClaim } from "@/api/edgeClaims";
import { approveEdgeClaim, rejectEdgeClaim } from "@/api/edgeClaimActions";
import { getNodeDetails, type NodeDetailsResponse } from "@/api/nodeDetails";
import { markEdgeNeedsReview, markNodeNeedsReview } from "@/api/review";
import { getNodeClaims, type NodeClaim } from "@/api/nodeClaims";
import { approveNodeClaim, rejectNodeClaim } from "@/api/nodeClaimActions";
import { fetchEdgeAudit, fetchNodeAudit, type AuditLogEntry } from "@/api/audit";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import * as d3 from "d3";
import { NodeEditModal } from "@/components/inspector/NodeEditModal";
import { ConnectModal } from "@/components/inspector/ConnectModal";
import { InspectorHeader } from "@/components/inspector/parts/InspectorHeader";
import { ReviewBanner } from "@/components/inspector/parts/ReviewBanner";
import { ReviewRequestModal } from "@/components/inspector/parts/ReviewRequestModal";
import { VerificationValue } from "@/components/inspector/parts/VerificationValue";
import { NodeInspectorBody } from "@/components/inspector/parts/NodeInspectorBody";
import { EdgeInspectorBody } from "@/components/inspector/parts/EdgeInspectorBody";
import { EdgeRelationCard } from "@/components/inspector/parts/EdgeRelationCard";
import { NewConnectionCard } from "@/components/inspector/parts/NewConnectionCard";
import { flowSummaryDir, ifMatchFromUpdatedAt, pickCurrentClaim, updatedAtToIfMatch } from "@/components/inspector/parts/inspectorPanelUtils";

type Props = {
  me: { username: string; role: string } | null;
  nodes: GraphNode[];
  links: GraphLink[];
  schema: SchemaKindsResponse | null;
  refreshToken?: number;
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  selectedEdgeId: string | null;

  reviewMode?: boolean;
  onExitReview?: () => void;

  onSelectNode: (id: string) => void;
  onSelectEdge: (id: string) => void;
  onClose: () => void;
  onClear: () => void;
  onError: (msg: string) => void;
  onRefresh: () => void | Promise<void>;
};

export function InspectorPanel({
  me,
  nodes,
  links,
  schema,
  selectedNodeId,
  selectedNodeIds,
  selectedEdgeId,
  reviewMode,
  onExitReview,
  onSelectNode,
  onSelectEdge,
  onClose,
  onClear,
  onError,
  onRefresh,
}: Props) {
  const singleNodeId = useMemo(() => {
    if (selectedEdgeId) return null;
    if (!Array.isArray(selectedNodeIds)) return null;
    if (selectedNodeIds.length !== 1) return null;
    const id = String(selectedNodeIds[0] ?? "").trim();
    return id ? id : null;
  }, [selectedNodeIds, selectedEdgeId]);

  const selectedNode = useMemo(() => nodes.find((n) => n.id === singleNodeId) ?? null, [nodes, singleNodeId]);
  const selectedEdge = useMemo(() => links.find((e) => e.id === selectedEdgeId) ?? null, [links, selectedEdgeId]);
  const byId = useMemo(() => nodeById(nodes), [nodes]);

  const graphColorForKind = useMemo(() => {
    const scale = d3.scaleOrdinal(d3.schemeObservable10 as unknown as string[]);
    for (const n of nodes) scale(String((n as any).kind ?? "default"));
    return (kind: string) => (scale(String(kind ?? "default")) as unknown as string);
  }, [nodes]);

  const [nodeDetails, setNodeDetails] = useState<NodeDetailsResponse | null>(null);
  const [nodeDetailsErr, setNodeDetailsErr] = useState<string | null>(null);

  const [edgeClaims, setEdgeClaims] = useState<EdgeClaim[] | null>(null);
  const currentClaim = useMemo(() => (edgeClaims ? pickCurrentClaim(edgeClaims) : null), [edgeClaims]);

  const [nodeClaims, setNodeClaims] = useState<NodeClaim[] | null>(null);
  const currentNodeClaim = useMemo(() => (nodeClaims ? pickCurrentClaim(nodeClaims) : null), [nodeClaims]);

  const [dirDraft, setDirDraft] = useState<FlowDirection>("source_to_target");

  const [createReviewLoading, setCreateReviewLoading] = useState(false);
  const [reviewActionLoading, setReviewActionLoading] = useState(false);

  const [nodeAudit, setNodeAudit] = useState<AuditLogEntry[] | null>(null);
  const [nodeAuditLoading, setNodeAuditLoading] = useState(false);
  const [nodeAuditErr, setNodeAuditErr] = useState<string | null>(null);

  const [edgeAudit, setEdgeAudit] = useState<AuditLogEntry[] | null>(null);
  const [edgeAuditLoading, setEdgeAuditLoading] = useState(false);
  const [edgeAuditErr, setEdgeAuditErr] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);

  const [connectOpen, setConnectOpen] = useState(false);
  const [connectFromIds, setConnectFromIds] = useState<string[]>([]);
  const [_, forceRerender] = useState(0);

  const nodeAuditLimited = useMemo(() => {
    const rows = (nodeAudit ?? []).slice();
    rows.sort((a, b) => {
      const ta = Date.parse(String(a.at ?? ""));
      const tb = Date.parse(String(b.at ?? ""));
      if (Number.isFinite(ta) && Number.isFinite(tb)) return tb - ta;
      return 0;
    });
    return rows.slice(0, 2);
  }, [nodeAudit]);

  const edgeAuditLimited = useMemo(() => {
    const rows = (edgeAudit ?? []).slice();
    rows.sort((a, b) => {
      const ta = Date.parse(String(a.at ?? ""));
      const tb = Date.parse(String(b.at ?? ""));
      if (Number.isFinite(ta) && Number.isFinite(tb)) return tb - ta;
      return 0;
    });
    return rows.slice(0, 2);
  }, [edgeAudit]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmKind, setConfirmKind] = useState<"delete_node" | "delete_edge" | null>(null);

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewDescription, setReviewDescription] = useState("");

  const [backNodeId, setBackNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (singleNodeId && !selectedEdgeId) setBackNodeId(null);
  }, [singleNodeId, selectedEdgeId]);

  useEffect(() => {
    if (selectedEdgeId) return;

    if (!singleNodeId) {
      setNodeDetails(null);
      setNodeDetailsErr(null);
      return;
    }

    let alive = true;
    setNodeDetails(null);
    setNodeDetailsErr(null);

    getNodeDetails(singleNodeId)
      .then((d) => {
        if (!alive) return;
        setNodeDetails(d);
      })
      .catch((e: any) => {
        if (!alive) return;
        setNodeDetailsErr(e?.message ?? String(e));
      });

    return () => {
      alive = false;
    };
  }, [singleNodeId, selectedEdgeId]);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (selectedEdgeId) {
        setNodeAudit(null);
        setNodeAuditErr(null);
        setNodeAuditLoading(false);
        return;
      }

      if (!singleNodeId) {
        setNodeAudit(null);
        setNodeAuditErr(null);
        setNodeAuditLoading(false);
        return;
      }

      try {
        setNodeAuditLoading(true);
        setNodeAuditErr(null);
        const rows = await fetchNodeAudit(singleNodeId, { limit: 200 });
        if (!alive) return;
        setNodeAudit(rows);
      } catch (e: any) {
        if (!alive) return;
        setNodeAudit(null);
        setNodeAuditErr(e?.message ?? String(e));
      } finally {
        if (!alive) return;
        setNodeAuditLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [singleNodeId, selectedEdgeId]);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!selectedEdge?.id) {
        setEdgeClaims(null);
        return;
      }
      try {
        const claims = await getEdgeClaims(selectedEdge.id);
        if (!alive) return;
        setEdgeClaims(claims);
      } catch {
        if (!alive) return;
        setEdgeClaims(null);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [selectedEdge?.id]);

  useEffect(() => {
    if (!reviewModalOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setReviewModalOpen(false);
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [reviewModalOpen]);

  useEffect(() => {
    if (selectedEdgeId) {
      setNodeClaims(null);
      return;
    }
    if (!singleNodeId) {
      setNodeClaims(null);
      return;
    }

    let alive = true;
    setNodeClaims(null);

    getNodeClaims(singleNodeId)
      .then((claims: NodeClaim[]) => {
        if (!alive) return;
        setNodeClaims(claims);
      })
      .catch(() => {
        if (!alive) return;
        setNodeClaims(null);
      });

    return () => {
      alive = false;
    };
  }, [singleNodeId, selectedEdgeId]);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!selectedEdge?.id) {
        setEdgeAudit(null);
        setEdgeAuditErr(null);
        setEdgeAuditLoading(false);
        return;
      }

      try {
        setEdgeAuditLoading(true);
        setEdgeAuditErr(null);
        const rows = await fetchEdgeAudit(selectedEdge.id, { limit: 200 });
        if (!alive) return;
        setEdgeAudit(rows);
      } catch (e: any) {
        if (!alive) return;
        setEdgeAudit(null);
        setEdgeAuditErr(e?.message ?? String(e));
      } finally {
        if (!alive) return;
        setEdgeAuditLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [selectedEdge?.id]);

  useEffect(() => {
    const flows = (currentClaim as any)?.flows ?? [];
    const d = flowSummaryDir(Array.isArray(flows) ? flows : []);
    setDirDraft(d);
  }, [currentClaim?.id]);

  async function doDeleteNode() {
    if (!selectedNode) return;
    try {
      await deleteNode(selectedNode.id, selectedNode.etag);
      onClear();
      await Promise.resolve(onRefresh());
    } catch (e: any) {
      onError(e?.message ?? String(e));
    }
  }

  async function doDeleteEdge() {
    if (!selectedEdge) return;
    try {
      await deleteEdge(selectedEdge.id, selectedEdge.etag);
      onClear();
      await Promise.resolve(onRefresh());
    } catch (e: any) {
      onError(e?.message ?? String(e));
    }
  }

  function openReviewModal() {
    setReviewDescription("");
    setReviewModalOpen(true);
  }

  async function doCreateReview() {
    if (!selectedEdge && !selectedNode) return;
    if (createReviewLoading) return;

    const desc = (reviewDescription ?? "").trim();
    if (!desc) {
      onError("Beskrivning krävs.");
      return;
    }

    try {
      setCreateReviewLoading(true);
      if (selectedEdge) {
        await markEdgeNeedsReview(selectedEdge.id, desc);
        await Promise.resolve(onRefresh());
        const claims = await getEdgeClaims(selectedEdge.id);
        setEdgeClaims(claims);
      } else if (selectedNode) {
        await markNodeNeedsReview(selectedNode.id, desc);
        await Promise.resolve(onRefresh());
        const claims = await getNodeClaims(selectedNode.id);
        setNodeClaims(claims);
      }

      setReviewModalOpen(false);
      setReviewDescription("");
    } catch (e: any) {
      onError(e?.message ?? String(e));
    } finally {
      setCreateReviewLoading(false);
    }
  }

  async function doApproveReview() {
    if (reviewActionLoading) return;
    const u = me?.username ?? "";
    if (!u) {
      onError("Du måste vara inloggad för att slutföra en granskning.");
      return;
    }

    const claim = selectedEdge ? (currentClaim as any) : (currentNodeClaim as any);
    if (!claim) return;
    if (claim.status !== "needs_review" && claim.status !== "rejected") return;
    const ifMatch = updatedAtToIfMatch(claim.updated_at);
    if (!ifMatch) {
      onError("Saknar updated_at för ärendet (If-Match)");
      return;
    }

    try {
      setReviewActionLoading(true);
      if (selectedEdge) {
        await approveEdgeClaim(claim.id, ifMatch);
        await Promise.resolve(onRefresh());
        setEdgeClaims(await getEdgeClaims(selectedEdge.id));
      } else if (selectedNode) {
        await approveNodeClaim(claim.id, ifMatch);
        await Promise.resolve(onRefresh());
        setNodeClaims(await getNodeClaims(selectedNode.id));
      }
    } catch (e: any) {
      onError(e?.message ?? String(e));
    } finally {
      setReviewActionLoading(false);
    }
  }

  async function doRejectReview() {
    if (reviewActionLoading) return;
    const u = me?.username ?? "";
    if (!u) {
      onError("Du måste vara inloggad för att slutföra en granskning.");
      return;
    }

    const claim = selectedEdge ? (currentClaim as any) : (currentNodeClaim as any);
    if (!claim) return;
    if (claim.status !== "needs_review") return;
    const ifMatch = updatedAtToIfMatch(claim.updated_at);
    if (!ifMatch) {
      onError("Saknar updated_at för ärendet (If-Match)");
      return;
    }

    const reason = ((): string | null => {
      const r = window.prompt("Anledning till avslag?", "");
      if (r === null) return null;
      const t = r.trim();
      return t.length ? t : null;
    })();

    try {
      setReviewActionLoading(true);
      if (selectedEdge) {
        await rejectEdgeClaim(claim.id, ifMatch, reason);
        await Promise.resolve(onRefresh());
        setEdgeClaims(await getEdgeClaims(selectedEdge.id));
      } else if (selectedNode) {
        await rejectNodeClaim(claim.id, ifMatch, reason);
        await Promise.resolve(onRefresh());
        setNodeClaims(await getNodeClaims(selectedNode.id));
      }
    } catch (e: any) {
      onError(e?.message ?? String(e));
    } finally {
      setReviewActionLoading(false);
    }
  }

  void selectedNodeId;
  void reviewMode;
  void onExitReview;

  const nodeMeta = selectedNode?.metadata ?? {};
  const edgeMeta = selectedEdge?.metadata ?? {};

  const currentReviewClaim: any = selectedEdge ? currentClaim : currentNodeClaim;
  const reviewRequested = currentReviewClaim?.status === "needs_review" || currentReviewClaim?.status === "rejected";

  const renderVerificationValue = ({ kind, id, verifiedAt }: { kind: "node" | "edge"; id: string; verifiedAt: any }) => {
    return (
      <VerificationValue
        kind={kind}
        id={id}
        verifiedAt={verifiedAt}
        me={me ? { username: me.username } : null}
        onVerified={() => forceRerender((x) => x + 1)}
      />
    );
  };

  return (
    <div className="panel-light" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      <InspectorHeader
        selectedNode={selectedNode}
        selectedEdge={selectedEdge}
        graphColorForKind={graphColorForKind}
        createReviewLoading={createReviewLoading}
        reviewRequested={reviewRequested}
        onEdit={() => setEditOpen(true)}
        onReview={() => {
          setReviewDescription("");
          setReviewModalOpen(true);
        }}
        onDeleteNode={() => {
          setConfirmKind("delete_node");
          setConfirmOpen(true);
        }}
        onDeleteEdge={() => {
          setConfirmKind("delete_edge");
          setConfirmOpen(true);
        }}
        onClose={onClose}
      />

      <ReviewBanner
        visible={reviewRequested}
        claim={currentReviewClaim}
        me={me}
        reviewActionLoading={reviewActionLoading}
        canAct={!!updatedAtToIfMatch(currentReviewClaim?.updated_at)}
        onApprove={doApproveReview}
        onReject={doRejectReview}
      />

      <ReviewRequestModal
        open={reviewModalOpen}
        createReviewLoading={createReviewLoading}
        reviewDescription={reviewDescription}
        setReviewDescription={setReviewDescription}
        selectedEdge={selectedEdge}
        selectedNode={selectedNode}
        nodes={nodes}
        onClose={() => setReviewModalOpen(false)}
        onCreate={doCreateReview}
      />

      {confirmOpen ? (
        <ConfirmModal
          open={confirmOpen}
          title={confirmKind === "delete_node" ? "Ta bort nod?" : "Ta bort koppling?"}
          message={
            confirmKind === "delete_node"
              ? "Detta tar bort noden. Detta kan påverka kopplingar."
              : "Detta tar bort kopplingen."
          }
          confirmText={confirmKind === "delete_node" ? "Ta bort nod" : "Ta bort koppling"}
          cancelText="Avbryt"
          danger={confirmKind === "delete_node"}
          onClose={() => {
            setConfirmOpen(false);
            setConfirmKind(null);
          }}
          onConfirm={async () => {
            setConfirmOpen(false);
            const k = confirmKind;
            setConfirmKind(null);
            if (k === "delete_node") await doDeleteNode();
            if (k === "delete_edge") await doDeleteEdge();
          }}
        />
      ) : null}

      <NewConnectionCard
        visible={!selectedEdgeId && Array.isArray(selectedNodeIds) && selectedNodeIds.length === 2}
        nodeIds={selectedNodeIds.slice(0, 2)}
        nodes={nodes}
        onCreate={() => {
          setConnectFromIds(selectedNodeIds.slice(0, 2));
          setConnectOpen(true);
        }}
      />

      {selectedEdge && (backNodeId || singleNodeId) ? (
        <button
          onClick={() => {
            const target = backNodeId ?? singleNodeId ?? "";
            if (target) onSelectNode(target);
          }}
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <ArrowLeft size={16} />
          Tillbaka
        </button>
      ) : null}

      {selectedNode && !selectedEdge ? (
        <NodeInspectorBody
          selectedNode={selectedNode}
          schema={schema}
          nodes={nodes}
          links={links}
          nodeDetails={nodeDetails}
          nodeDetailsErr={nodeDetailsErr}
          nodeMeta={nodeMeta}
          currentNodeClaim={currentNodeClaim}
          me={me}
          byId={byId}
          onAddConnection={() => {
            setConnectFromIds([selectedNode.id]);
            setConnectOpen(true);
          }}
          onOpenEdge={(edgeId) => {
            setBackNodeId(selectedNode.id);
            onSelectEdge(edgeId);
          }}
          renderVerificationValue={({ id, verifiedAt }) => renderVerificationValue({ kind: "node", id, verifiedAt })}
        />
      ) : null}

      {selectedNode && !selectedEdge ? (
        <AuditTimeline
          title="Historik"
          entityLabel={`Nod: ${selectedNode.name}`}
          entries={nodeAuditLimited}
          loading={nodeAuditLoading}
          error={nodeAuditErr}
        />
      ) : null}

      {selectedEdge ? (
        <>
          <EdgeInspectorBody
            selectedEdge={selectedEdge}
            nodes={nodes}
            links={links}
            edgeMeta={edgeMeta}
            dirDraft={dirDraft}
            currentClaim={currentClaim}
            me={me}
            forceRerender={forceRerender}
            slaValueClass={slaValueClass}
            verificationValue={renderVerificationValue}
          />

          <EdgeRelationCard selectedEdge={selectedEdge} dirDraft={dirDraft} nodes={nodes} onSelectNode={onSelectNode} />
        </>
      ) : null}

      {selectedEdge ? (
        <AuditTimeline
          title="Historik"
          entityLabel="Koppling"
          entries={edgeAuditLimited}
          loading={edgeAuditLoading}
          error={edgeAuditErr}
        />
      ) : null}

      <ConnectModal
        open={connectOpen}
        fromNodeIds={connectFromIds}
        onClose={() => {
          setConnectOpen(false);
          setConnectFromIds([]);
        }}
        onCreated={async () => {
          await Promise.resolve(onRefresh());
          setConnectOpen(false);
          setConnectFromIds([]);
        }}
        onError={onError}
      />

      <NodeEditModal
        open={editOpen}
        mode={selectedEdge ? "edge" : "node"}
        nodeId={selectedNode?.id ?? null}
        edge={selectedEdge ?? null}
        nodes={nodes}
        schema={schema}
        onClose={() => setEditOpen(false)}
        onSaved={async () => {
          await Promise.resolve(onRefresh());
          setEditOpen(false);
        }}
        onError={onError}
      />
    </div>
  );
}
