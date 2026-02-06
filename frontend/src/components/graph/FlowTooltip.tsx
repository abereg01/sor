import React from "react";

export type TooltipState =
  | { visible: true; x: number; y: number; title: string; lines: string[]; color: string }
  | { visible: false };

export function FlowTooltip({ tooltip }: { tooltip: TooltipState }) {
  if (!tooltip.visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: tooltip.x,
        top: tooltip.y,
        zIndex: 10,
        pointerEvents: "none",
        maxWidth: 360,
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid var(--panel-border)",
        background: "var(--overlay-strong)",
        backdropFilter: "blur(10px)",
        boxShadow: "0 10px 30px var(--overlay-medium)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: 3,
            background: tooltip.color,
            boxShadow: "0 0 0 1px var(--border-subtle) inset",
          }}
        />
        <div style={{ fontWeight: 600, fontSize: 13 }}>{tooltip.title}</div>
      </div>

      <div style={{ display: "grid", gap: 3, fontSize: 12, opacity: 0.9 }}>
        {tooltip.lines.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}
