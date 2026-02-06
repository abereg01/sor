import type { FlowDirection, SchemaKindsResponse } from "@/api/types";

export function nodeKindLabelSv(kind: string, schema: SchemaKindsResponse | null) {
  const k = String(kind || "");
  const fromSchema = schema?.node_kinds?.find((s) => s.kind === k)?.display_name;
  if (fromSchema) return fromSchema;
  if (!k) return "—";
  return k.charAt(0).toUpperCase() + k.slice(1);
}

export function relationLabelSv(kind: string) {
  const k = String(kind || "");
  const map: Record<string, string> = {
    depends_on: "Beroende av",
    runs_on: "Körs på",
    stores_data: "Lagrar data i",
    flows_to: "Flödar till",
    owned_by: "Ägs av",
    external_dependency: "Externt beroende",
    backs_up_to: "Backar upp till",
  };
  return map[k] ?? "Koppling";
}

export function directionLabelSv(d: FlowDirection) {
  if (d === "source_to_target") return "Källa → Mål";
  if (d === "target_to_source") return "Mål → Källa";
  if (d === "bidirectional") return "Dubbelriktad";
  return d;
}
