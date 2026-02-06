import type { SchemaKind, SchemaKindsResponse } from "@/api/types";

export function nodeKindLabel(schema: SchemaKindsResponse | null, kind: string) {
  const k = String(kind ?? "");
  if (!k) return "—";

  const fromSchema = schema?.node_kinds?.find((x: SchemaKind) => x.kind === k)?.display_name;
  return fromSchema ?? k;
}

export function edgeKindLabel(schema: SchemaKindsResponse | null, kind: string) {
  const k = String(kind ?? "");
  if (!k) return "—";

  const fromSchema = schema?.edge_kinds?.find((x: SchemaKind) => x.kind === k)?.display_name;
  return fromSchema ?? k;
}
