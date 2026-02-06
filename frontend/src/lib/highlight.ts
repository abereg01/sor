export type HighlightState = {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  label?: string;
  dimOthers?: boolean;
};

export function emptyHighlight(): HighlightState {
  return { nodeIds: new Set(), edgeIds: new Set(), label: undefined, dimOthers: false };
}

export function fromIds(
  node_ids: string[] | undefined,
  edge_ids: string[] | undefined,
  label?: string,
  dimOthers = true
): HighlightState {
  return {
    nodeIds: new Set(node_ids ?? []),
    edgeIds: new Set(edge_ids ?? []),
    label,
    dimOthers,
  };
}
