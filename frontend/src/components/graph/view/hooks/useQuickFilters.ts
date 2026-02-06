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

export function useQuickFilters(args: {
  nodes: GraphNode[];
  selectedNodeId?: string | null;
  selectedNodeIds: Set<string>;
}) {
  const { nodes, selectedNodeId, selectedNodeIds } = args;

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [metadataFilters, setMetadataFilters] = useState<MetadataFilterState>(DEFAULT_METADATA_FILTERS);

  const metadataFilterOptions = useMemo(() => buildMetadataFilterOptions(nodes), [nodes]);

  const quickFilterActive = useMemo(() => isMetadataFilterActive(metadataFilters), [metadataFilters]);

  const matchesQuickFilters = useMemo(() => {
    return computeMatchesForMetadataFilters({
      nodes,
      filters: metadataFilters,
      selectedNodeIds,
      selectedNodeId,
    });
  }, [nodes, metadataFilters, selectedNodeId, selectedNodeIds]);

  const filterSummary = useMemo(() => {
    return buildMetadataFilterSummarySv(metadataFilters, metadataFilterOptions);
  }, [metadataFilters, metadataFilterOptions]);

  function clearFilters() {
    setMetadataFilters(DEFAULT_METADATA_FILTERS);
  }

  return {
    filtersOpen,
    setFiltersOpen,
    metadataFilters,
    setMetadataFilters,
    metadataFilterOptions,
    quickFilterActive,
    matchesQuickFilters,
    filterSummary,
    clearFilters,
  };
}
