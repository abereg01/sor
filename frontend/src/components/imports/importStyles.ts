import type React from "react";

export function cardStyle(): React.CSSProperties {
  return {
    borderRadius: 14,
    border: "1px solid var(--border-subtle)",
    background: "var(--surface)",
    padding: 12,
  };
}

export function buttonStyle(kind: "primary" | "danger" | "ghost" = "primary"): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid var(--border-strong)",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 12,
  };

  if (kind === "danger") return { ...base, background: "var(--danger-bg)" };
  if (kind === "ghost") return { ...base, background: "var(--surface)" };
  return { ...base, background: "var(--info-bg)" };
}

export function miniMuted(): React.CSSProperties {
  return { fontSize: 12, opacity: 0.75 };
}

export function pill(text: string, tone: "ok" | "warn" | "muted" = "muted"): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid var(--border-strong)",
    background: "var(--surface)",
    color: "var(--text-primary)",
  };
  if (tone === "ok") return { ...base, border: "1px solid var(--success-border)", background: "var(--success-bg)" };
  if (tone === "warn") return { ...base, border: "1px solid var(--warning-border)", background: "var(--warning-bg)" };
  return base;
}
