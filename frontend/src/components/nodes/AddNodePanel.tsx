import { useMemo, useState } from "react";
import { createNode } from "@/api/nodes";

type Props = {
  onCreated: () => Promise<void> | void;
  onCreatedNode: (id: string) => void;
  onError: (msg: string) => void;
};

const NODE_KINDS: Array<{ value: string; label: string }> = [
  { value: "system", label: "System" },
  { value: "service", label: "Tjänst" },
  { value: "database", label: "Databas" },
  { value: "host", label: "Host" },
  { value: "vendor", label: "Leverantör" },
  { value: "team", label: "Team" },
  { value: "data_category", label: "Datakategori" },
  { value: "app", label: "App" },
  { value: "container", label: "Container" },
  { value: "external_dependency", label: "Extern beroende" },
];

const BACKUP_POLICIES = ["Nattligen", "Veckovis", "Månadsvis"];
const MILJO = ["Produktion", "Utveckling"];
const YES_NO = ["Ja", "Nej"];
const DOMAINS = ["KEAB", "Process"];

export function AddNodePanel({ onCreated, onCreatedNode, onError }: Props) {
  const [kind, setKind] = useState("service");
  const [name, setName] = useState("");

  const [meta, setMeta] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  const requiredFields = ["owner_team", "backup_policy", "description", "env", "critical", "domain", "sla"];

  const requiredReady = useMemo(() => {
    if (!name.trim()) return false;
    return requiredFields.every((k) => !!meta[k]?.trim());
  }, [name, meta]);

  function setMetaField(key: string, value: string) {
    setMeta((m) => ({ ...m, [key]: value }));
  }

  async function onCreate() {
    if (!requiredReady) return;
    if (creating) return;

    setCreating(true);
    try {
      const node = await createNode({
        kind,
        name: name.trim(),
        metadata: meta,
      });
      await Promise.resolve(onCreated());
      onCreatedNode(node.id);
      setName("");
      setMeta({});
      setKind("service");
    } catch (e: any) {
      onError(e?.message ?? String(e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="panel-subtle">
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Nodinformation</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {NODE_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>

          <input
            placeholder="Namn på nod, ex Nextcloud, Aidon"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            placeholder="Systemägare"
            value={meta.owner_team ?? ""}
            onChange={(e) => setMetaField("owner_team", e.target.value)}
          />

          <select value={meta.backup_policy ?? ""} onChange={(e) => setMetaField("backup_policy", e.target.value)}>
            <option value="">Backup-policy</option>
            {BACKUP_POLICIES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>

          <textarea
            placeholder="Beskrivning"
            value={meta.description ?? ""}
            onChange={(e) => setMetaField("description", e.target.value)}
          />

          <select value={meta.env ?? ""} onChange={(e) => setMetaField("env", e.target.value)}>
            <option value="">Miljö</option>
            {MILJO.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>

          <select value={meta.critical ?? ""} onChange={(e) => setMetaField("critical", e.target.value)}>
            <option value="">Kritisk</option>
            {YES_NO.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>

          <select value={meta.domain ?? ""} onChange={(e) => setMetaField("domain", e.target.value)}>
            <option value="">Domän</option>
            {DOMAINS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>

          <select value={meta.sla ?? ""} onChange={(e) => setMetaField("sla", e.target.value)}>
            <option value="">SLA</option>
            {YES_NO.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>

          <button disabled={!requiredReady || creating} onClick={onCreate}>
            {creating ? "Skapar…" : "Skapa nod"}
          </button>
        </div>
      </div>
    </div>
  );
}
