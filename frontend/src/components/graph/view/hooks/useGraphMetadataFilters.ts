import { useMemo, useState } from "react";

import type { GraphNode } from "@/api/types";

import {
  DEFAULT_METADATA_FILTERS,
  buildMetadataFilterOptions,
  buildMetadataFilterSummarySv,
  computeMatchesForMetadataFilters,
  isMetadataFilterActive,
  type MetadataFilterState,
} from "@/components/graph/MetadataFilterPill";

export function useGraphMetadataFilters(args: {
  nodes: GraphNode[];
  selectedNodeId?: string | null;
  selectedNodeSet: Set<string>;
}) {
  const { nodes, selectedNodeId, selectedNodeSet } = args;

  const [metadataFilters, setMetadataFilters] = useState<MetadataFilterState>(DEFAULT_METADATA_FILTERS);

  const metadataFilterOptions = useMemo(() => buildMetadataFilterOptions(nodes), [nodes]);

  const quickFilterActive = useMemo(() => isMetadataFilterActive(metadataFilters), [metadataFilters]);

  const matchesQuickFilters = useMemo(() => {
    return computeMatchesForMetadataFilters({
      nodes,
      filters: metadataFilters,
      selectedNodeIds: selectedNodeSet,
      selectedNodeId,
    });
  }, [nodes, metadataFilters, selectedNodeId, selectedNodeSet]);

  const filterSummary = useMemo(() => {
    return buildMetadataFilterSummarySv(metadataFilters, metadataFilterOptions);
  }, [metadataFilters, metadataFilterOptions]);

  function clearFilters() {
    setMetadataFilters(DEFAULT_METADATA_FILTERS);
  }

  return {
    metadataFilters,
    setMetadataFilters,
    metadataFilterOptions,
    quickFilterActive,
    matchesQuickFilters,
    filterSummary,
    clearFilters,
  };
}
