import React from "react";
import type { GraphLink, GraphNode, SchemaKindsResponse } from "@/api/types";
import { ImportSimpleForm } from "./ImportSimpleForm";

type Props = {
  nodes: GraphNode[];
  links: GraphLink[];
  schema: SchemaKindsResponse | null;
  onRefreshGraph: () => void;
  onError: (msg: string) => void;
};

export function ImportPanel({ onRefreshGraph, onError }: Props) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <ImportSimpleForm
        onImported={onRefreshGraph}
        onError={onError}
      />
    </div>
  );
}
