import { useEffect, useMemo, useRef, useState } from "react";
import { listDataDomains, buildDomainTree, type DataDomainNode } from "@/api/dataDomains";
import { getEdgeTypedFlows, putEdgeTypedFlows, type EdgeTypedFlow } from "@/api/edgeTypedFlows";
import { TypedFlowDomainSelector } from "@/components/edges/TypedFlowDomainSelector";

type YesNo = "Ja" | "Nej";
type Env = "prod" | "dev" | "test" | "stage";
type Domain = "KEAB" | "Process";

export type MetadataFormValue = {
  owner_team: string;
  backup_policy: string;
  description: string;

  env: Env | "";
  critical: YesNo | "";
  domain: Domain | "";
  sla: YesNo | "";

  engine: string;
  version: string;
};

function fromMeta(meta: Record<string, any> | null | undefined): MetadataFormValue {
  const m = meta ?? {};

  const domainRaw = typeof m.domain === "string" ? m.domain.trim() : "";
  const domainNorm: Domain | "" = (() => {
    if (domainRaw === "") return "";
    const s = domainRaw.toLowerCase();
    if (s === "keab") return "KEAB";
    if (s === "process") return "Process";
    if (domainRaw === "KEAB" || domainRaw === "Process") return domainRaw as Domain;
    return "";
  })();

  return {
    owner_team: typeof m.owner_team === "string" ? m.owner_team : "",
    backup_policy: typeof m.backup_policy === "string" ? m.backup_policy : "",
    description: typeof m.description === "string" ? m.description : "",

    env: typeof m.env === "string" ? (m.env as Env) : "",
    critical:
      typeof m.critical === "boolean"
        ? m.critical
          ? "Ja"
          : "Nej"
        : typeof m.critical === "string"
          ? (m.critical as YesNo)
          : "",
    domain: domainNorm,
    sla:
      typeof m.sla === "boolean"
        ? m.sla
          ? "Ja"
          : "Nej"
        : typeof m.sla === "string"
          ? (m.sla as YesNo)
          : "",

    engine: typeof m.engine === "string" ? m.engine : "",
    version: typeof m.version === "string" ? m.version : "",
  };
}

function toPatch(v: MetadataFormValue): Record<string, any> {
  const patch: Record<string, any> = {};

  if (v.owner_team.trim() !== "") patch.owner_team = v.owner_team.trim();
  if (v.backup_policy.trim() !== "") patch.backup_policy = v.backup_policy.trim();
  if (v.description.trim() !== "") patch.description = v.description.trim();

  if (v.env !== "") patch.env = v.env;
  if (v.domain !== "") patch.domain = v.domain;

  if (v.critical !== "") patch.critical = v.critical === "Ja";
  if (v.sla !== "") patch.sla = v.sla === "Ja";

  if (v.engine.trim() !== "") patch.engine = v.engine.trim();
  if (v.version.trim() !== "") patch.version = v.version.trim();

  return patch;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 650 }}>{label}</div>
        {hint ? <div style={{ fontSize: 12, color: "var(--border-strong)" }}>{hint}</div> : null}
      </div>
      {children}
    </div>
  );
}

function normalizeOwner(s: string) {
  return s.trim();
}

function startsWithIgnoreCase(hay: string, needle: string) {
  return hay.toLowerCase().startsWith(needle.toLowerCase());
}

export function MetadataFormModal({
  open,
  title,
  mode = "node",
  edgeId,
  initialMetadata,
  initialKey,
  ownerSuggestions,
  onClose,
  onSavePatch,
}: {
  open: boolean;
  title: string;
  mode?: "node" | "edge";
  edgeId?: string;
  initialMetadata: Record<string, any> | null | undefined;
  initialKey?: string;
  ownerSuggestions?: string[];
  onClose: () => void;
  onSavePatch: (patch: Record<string, any>) => Promise<void>;
}) {
  const initial = useMemo(() => fromMeta(initialMetadata), [initialKey]);
  const [v, setV] = useState<MetadataFormValue>(initial);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [ownerOpen, setOwnerOpen] = useState(false);
  const ownerBoxRef = useRef<HTMLDivElement | null>(null);

  const [domainTree, setDomainTree] = useState<DataDomainNode[] | null>(null);
  const [typedFlowTab, setTypedFlowTab] = useState<EdgeTypedFlow["direction"]>("fran");
  const [typedSelected, setTypedSelected] = useState<Record<EdgeTypedFlow["direction"], Set<string>>>({
    fran: new Set<string>(),
    till: new Set<string>(),
    bidirectional: new Set<string>(),
  });

  useEffect(() => {
    if (!open) return;
    setV(initial);
    setErr(null);
    setSaving(false);
    setOwnerOpen(false);

    if (mode === "edge" && edgeId) {
      setTypedFlowTab("fran");
      setTypedSelected({
        fran: new Set<string>(),
        till: new Set<string>(),
        bidirectional: new Set<string>(),
      });
      setDomainTree(null);
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    if (mode !== "edge" || !edgeId) return;

    const id = edgeId;
    let cancelled = false;

    async function load() {
      const [rows, flows] = await Promise.all([listDataDomains(), getEdgeTypedFlows(id)]);
      if (cancelled) return;
      setDomainTree(buildDomainTree(rows));

      const next: Record<EdgeTypedFlow["direction"], Set<string>> = {
        fran: new Set<string>(),
        till: new Set<string>(),
        bidirectional: new Set<string>(),
      };
      for (const f of flows) {
        for (const domainId of f.domain_ids) next[f.direction].add(domainId);
      }
      setTypedSelected(next);
    }

    load().catch((e: any) => {
      if (cancelled) return;
      setErr(e?.message ?? String(e));
    });

    return () => {
      cancelled = true;
    };
  }, [open, mode, edgeId]);

  useEffect(() => {
    if (!ownerOpen) return;

    function onDocDown(e: MouseEvent) {
      const el = ownerBoxRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setOwnerOpen(false);
    }

    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [ownerOpen]);

  const ownerOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of ownerSuggestions ?? []) {
      if (typeof s === "string" && s.trim() !== "") set.add(normalizeOwner(s));
    }
    const cur = normalizeOwner(v.owner_team);
    if (cur !== "") set.add(cur);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "sv"));
  }, [ownerSuggestions, v.owner_team]);

  const ownerFiltered = useMemo(() => {
    const q = normalizeOwner(v.owner_team);
    if (q === "") return ownerOptions.slice(0, 12);
    const starts = ownerOptions.filter((s) => startsWithIgnoreCase(s, q));
    const contains = ownerOptions.filter((s) => !startsWithIgnoreCase(s, q) && s.toLowerCase().includes(q.toLowerCase()));
    return [...starts, ...contains].slice(0, 12);
  }, [ownerOptions, v.owner_team]);

  const ownerBestMatch = useMemo(() => {
    const q = normalizeOwner(v.owner_team);
    if (q === "") return null;
    const first = ownerOptions.find((s) => startsWithIgnoreCase(s, q));
    return first ?? null;
  }, [ownerOptions, v.owner_team]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "var(--overlay-strong)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 14,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="panel-light"
        style={{
          width: "min(760px, 100%)",
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid var(--panel-border)",
          background: "var(--panel-bg)",
        }}
      >
        <div style={{ padding: "14px 14px 0 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{title}</div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              disabled={saving}
              onClick={async () => {
                try {
                  setSaving(true);
                  setErr(null);
                  const raw = toPatch(v);
                  const patch =
                    mode === "edge"
                      ? (() => {
                          const { owner_team, backup_policy, env, engine, version, ...rest } = raw;
                          void owner_team;
                          void backup_policy;
                          void env;
                          void engine;
                          void version;
                          return rest;
                        })()
                      : raw;

                  await onSavePatch(patch);

                  if (mode === "edge" && edgeId) {
                    const flows: EdgeTypedFlow[] = (["fran", "till", "bidirectional"] as const).map((dir) => ({
                      direction: dir,
                      domain_ids: Array.from(typedSelected[dir]),
                    }));
                    await putEdgeTypedFlows(edgeId, { flows });
                  }

                  onClose();
                } catch (e: any) {
                  setErr(e?.message ?? String(e));
                  setSaving(false);
                }
              }}
              style={{ padding: "9px 10px" }}
            >
              Spara
            </button>

            <button disabled={saving} onClick={onClose} style={{ padding: "9px 10px" }}>
              Avbryt
            </button>
          </div>
        </div>

        {err ? (
          <div style={{ padding: 14 }}>
            <div style={{ borderRadius: 14, border: "1px solid var(--danger-border)", background: "var(--danger-bg)", padding: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Fel</div>
              <div style={{ fontSize: 13 }}>{err}</div>
            </div>
          </div>
        ) : null}

        {mode === "node" ? (
          <div style={{ padding: "0 14px 14px 14px" }}>
            <div
              style={{
                borderRadius: 14,
                border: "1px solid var(--panel-subtle-border)",
                background: "var(--panel-subtle-bg)",
                padding: 12,
              }}
            >
              <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400 }}>
                Detta är legacy-metadata. Nya strukturerade fält redigeras i flikarna i Inspektören.
              </div>
            </div>
          </div>
        ) : null}

        <div style={{ padding: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {mode === "node" ? (
            <>
              <Field
                label="Ägare"
                hint={
                  ownerBestMatch && normalizeOwner(v.owner_team) !== "" && normalizeOwner(v.owner_team) !== ownerBestMatch
                    ? `↵ för "${ownerBestMatch}"`
                    : undefined
                }
              >
                <div ref={ownerBoxRef} style={{ position: "relative" }}>
                  <input
                    value={v.owner_team}
                    onChange={(e) => {
                      setV((p) => ({ ...p, owner_team: e.target.value }));
                      setOwnerOpen(true);
                    }}
                    onFocus={() => setOwnerOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setOwnerOpen(false);
                        return;
                      }
                      if (e.key === "Enter") {
                        const q = normalizeOwner(v.owner_team);
                        if (q !== "" && ownerBestMatch && startsWithIgnoreCase(ownerBestMatch, q)) {
                          e.preventDefault();
                          setV((p) => ({ ...p, owner_team: ownerBestMatch }));
                          setOwnerOpen(false);
                          return;
                        }
                        setOwnerOpen(false);
                      }
                      if (e.key === "ArrowDown") {
                        setOwnerOpen(true);
                      }
                    }}
                    placeholder="—"
                  />

                  {ownerOpen ? (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 6px)",
                        left: 0,
                        right: 0,
                        zIndex: 10,
                        borderRadius: 14,
                        border: "1px solid var(--panel-border)",
                        background: "var(--panel-bg-2)",
                        boxShadow: "0 14px 30px var(--shadow-elev-1)",
                        overflow: "hidden",
                      }}
                    >
                      {ownerFiltered.length === 0 ? (
                        <div style={{ padding: "10px 10px", fontSize: 13, color: "var(--overlay-strong)" }}>
                          Inga träffar. Spara för att skapa <strong>{normalizeOwner(v.owner_team) || "—"}</strong>.
                        </div>
                      ) : (
                        ownerFiltered.map((s) => {
                          const q = normalizeOwner(v.owner_team);
                          const isBest = ownerBestMatch === s && q !== "" && startsWithIgnoreCase(s, q);
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => {
                                setV((p) => ({ ...p, owner_team: s }));
                                setOwnerOpen(false);
                              }}
                              style={{
                                width: "100%",
                                textAlign: "left",
                                padding: "10px 10px",
                                border: "none",
                                borderBottom: "1px solid var(--panel-subtle-border)",
                                background: isBest ? "var(--panel-subtle-bg)" : "transparent",
                                color: "var(--panel-text)",
                                borderRadius: 0,
                                cursor: "pointer",
                              }}
                            >
                              <span style={{ fontWeight: 600 }}>{s}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  ) : null}
                </div>
              </Field>

              <Field label="Backup-policy">
                <select value={v.backup_policy} onChange={(e) => setV((p) => ({ ...p, backup_policy: e.target.value }))}>
                  <option value="">—</option>
                  <option value="Nattlig">Nattlig</option>
                  <option value="Veckovis">Veckovis</option>
                  <option value="Månadsvis">Månadsvis</option>
                </select>
              </Field>

              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Beskrivning" hint="Valfri">
                  <textarea rows={4} value={v.description} onChange={(e) => setV((p) => ({ ...p, description: e.target.value }))} />
                </Field>
              </div>

              <Field label="Miljö">
                <select value={v.env} onChange={(e) => setV((p) => ({ ...p, env: e.target.value as Env }))}>
                  <option value="">—</option>
                  <option value="prod">prod</option>
                  <option value="dev">dev</option>
                  <option value="test">test</option>
                  <option value="stage">stage</option>
                </select>
              </Field>
            </>
          ) : (
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Beskrivning" hint="Valfri">
                <textarea rows={4} value={v.description} onChange={(e) => setV((p) => ({ ...p, description: e.target.value }))} />
              </Field>
            </div>
          )}

          <Field label="Kritisk">
            <select value={v.critical} onChange={(e) => setV((p) => ({ ...p, critical: e.target.value as YesNo }))}>
              <option value="">—</option>
              <option value="Ja">Ja</option>
              <option value="Nej">Nej</option>
            </select>
          </Field>

          <Field label="Domän">
            <select value={v.domain} onChange={(e) => setV((p) => ({ ...p, domain: e.target.value as Domain }))}>
              <option value="">—</option>
              <option value="KEAB">KEAB</option>
              <option value="Process">Process</option>
            </select>
          </Field>

          <Field label="SLA">
            <select value={v.sla} onChange={(e) => setV((p) => ({ ...p, sla: e.target.value as YesNo }))}>
              <option value="">—</option>
              <option value="Ja">Ja</option>
              <option value="Nej">Nej</option>
            </select>
          </Field>

          {mode === "node" ? (
            <>
              <Field label="Databasmotor" hint="Valfri">
                <input value={v.engine} onChange={(e) => setV((p) => ({ ...p, engine: e.target.value }))} />
              </Field>

              <Field label="Version" hint="Valfri">
                <input value={v.version} onChange={(e) => setV((p) => ({ ...p, version: e.target.value }))} />
              </Field>
            </>
          ) : null}
        </div>

        {mode === "edge" ? (
          <div style={{ padding: "0 14px 14px 14px" }}>
            <div
              style={{
                borderRadius: 16,
                border: "1px solid var(--panel-subtle-border)",
                background: "var(--panel-subtle-bg)",
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Typade datatyper (flöden)</div>

              {!edgeId ? (
                <div style={{ fontSize: 13, color: "var(--panel-text-2)" }}>Ingen edge vald.</div>
              ) : !domainTree ? (
                <div style={{ fontSize: 13, color: "var(--panel-text-2)" }}>Laddar datadomäner…</div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                    {([
                      { key: "fran", label: "Från" },
                      { key: "till", label: "Till" },
                      { key: "bidirectional", label: "Bidirectional" },
                    ] as const).map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setTypedFlowTab(t.key)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 999,
                          border: "1px solid var(--panel-border)",
                          background: typedFlowTab === t.key ? "var(--panel-subtle-border)" : "var(--panel-bg)",
                          fontWeight: 600,
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  <TypedFlowDomainSelector
                    tree={domainTree}
                    selectedIds={Array.from(typedSelected[typedFlowTab])}
                    onChange={(next: string[]) =>
                      setTypedSelected((p) => ({
                        ...p,
                        [typedFlowTab]: new Set(next),
                      }))
                    }
                  />
                </>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
