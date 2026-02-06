import type { SchemaKindsResponse } from "@/api/types";

export type RecommendedKey = {
  key: string;
  description?: string;
  examples?: string[];
};

type UiHint = NonNullable<SchemaKindsResponse["node_kinds"][number]["ui_hints"]>[number];

function svDescriptionFromUiHint(h: UiHint | undefined): string | undefined {
  if (!h) return undefined;
  if (h.help_sv && h.help_sv.trim().length) return `${h.label_sv} — ${h.help_sv}`;
  return h.label_sv;
}

export function nodeGuidance(schema: SchemaKindsResponse | null, kind: string): RecommendedKey[] {
  if (!schema) return [];
  const hit = schema.node_kinds.find((k) => k.kind === kind);
  return (hit as any)?.recommended_metadata_keys ?? [];
}

export function edgeGuidance(schema: SchemaKindsResponse | null, kind: string): RecommendedKey[] {
  if (!schema) return [];
  const hit = schema.edge_kinds.find((k) => k.kind === kind);
  return (hit as any)?.recommended_metadata_keys ?? [];
}

export function nodeUiHints(schema: SchemaKindsResponse | null, kind: string): UiHint[] {
  if (!schema) return [];
  return (schema.node_kinds.find((k) => k.kind === kind)?.ui_hints ?? []) as UiHint[];
}

export function edgeUiHints(schema: SchemaKindsResponse | null, kind: string): UiHint[] {
  if (!schema) return [];
  return (schema.edge_kinds.find((k) => k.kind === kind)?.ui_hints ?? []) as UiHint[];
}

export function nodeGuidanceSv(schema: SchemaKindsResponse | null, kind: string): RecommendedKey[] {
  if (!schema) return [];
  const hit = schema.node_kinds.find((k) => k.kind === kind) as any;
  if (!hit) return [];
  const hints: UiHint[] = (hit.ui_hints ?? []) as UiHint[];
  const recs: RecommendedKey[] = (hit.recommended_metadata_keys ?? []) as RecommendedKey[];

  return recs.map((rk: RecommendedKey) => {
    const h = hints.find((x: UiHint) => x.key === rk.key);
    return { ...rk, description: svDescriptionFromUiHint(h) ?? rk.description };
  });
}

export function edgeGuidanceSv(schema: SchemaKindsResponse | null, kind: string): RecommendedKey[] {
  if (!schema) return [];
  const hit = schema.edge_kinds.find((k) => k.kind === kind) as any;
  if (!hit) return [];
  const hints: UiHint[] = (hit.ui_hints ?? []) as UiHint[];
  const recs: RecommendedKey[] = (hit.recommended_metadata_keys ?? []) as RecommendedKey[];

  return recs.map((rk: RecommendedKey) => {
    const h = hints.find((x: UiHint) => x.key === rk.key);
    return { ...rk, description: svDescriptionFromUiHint(h) ?? rk.description };
  });
}
