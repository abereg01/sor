import React from "react";
import type { FlowDirection } from "@/api/types";

export function directionBadge(d: FlowDirection) {
  const base: React.CSSProperties = {
    width: 10,
    height: 10,
    borderRadius: 999,
    flexShrink: 0,
  };

  if (d === "source_to_target") {
    return <span style={{ ...base, background: "var(--accent)", boxShadow: "0 0 0 4px var(--focus-ring)" }} />;
  }

  if (d === "target_to_source") {
    return <span style={{ ...base, background: "var(--success)", boxShadow: "0 0 0 4px rgba(var(--rgb-success),0.22)" }} />;
  }

  return (
    <span
      style={{
        ...base,
        background: "linear-gradient(90deg, var(--accent), var(--success))",
        boxShadow: "0 0 0 4px rgba(var(--rgb-accent),0.14)",
      }}
    />
  );
}
