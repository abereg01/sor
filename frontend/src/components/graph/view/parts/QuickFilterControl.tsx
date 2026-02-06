import { SlidersHorizontal } from "lucide-react";

import type { GraphNode } from "@/api/types";
import { MetadataFilterPill, type MetadataFilterState } from "@/components/graph/MetadataFilterPill";

type Props = {
  rightPx: number;

  open: boolean;
  onOpenChange: (open: boolean) => void;

  nodes: GraphNode[];
  filters: MetadataFilterState;
  onChange: (next: MetadataFilterState) => void;

  active: boolean;
  summary: string;
  onClear: () => void;
};

export function QuickFilterControl({
  rightPx,
  open,
  onOpenChange,
  nodes,
  filters,
  onChange,
  active,
  summary,
  onClear,
}: Props) {
  return (
    <div
      className="graph-qf-wrap"
      style={{ "--qf-right": `${rightPx}px` } as any}
      onWheelCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onTouchMoveCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div className="graph-qf-inner">
        <button
          type="button"
          className="qf-icon-btn"
          title="Filter"
          aria-label="Filter"
          onClick={() => onOpenChange(!open)}
        >
          <SlidersHorizontal className="graph-qf-icon" />
          {active ? <span className="graph-qf-dot" /> : null}
        </button>

        {open ? (
          <div className="graph-qf-panel">
            <MetadataFilterPill
              open={open}
              onOpenChange={onOpenChange}
              nodes={nodes}
              filters={filters}
              onChange={onChange}
              active={active}
              summary={summary}
              onClear={onClear}
              showTrigger={false}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
