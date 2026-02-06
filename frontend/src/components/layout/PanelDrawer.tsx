import { useEffect } from "react";

export function PanelDrawer({ open, children }: { open: boolean; children: React.ReactNode }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        const el = document.getElementById("lig-inspector-close");
        if (el) (el as HTMLButtonElement).click();
      }
    }
    if (!open) return;
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        zIndex: 6,
        width: 440,
        maxWidth: "calc(100% - 24px)",
        height: "calc(100% - 24px)",
        pointerEvents: open ? "auto" : "none",
      }}
    >
      <div
        style={{
          height: "100%",
          borderRadius: 16,
          border: "1px solid var(--panel-border)",
          background: "var(--panel-bg)",
          boxShadow: "0 18px 48px var(--shadow-elev-2)",
          transform: open ? "translateX(0)" : "translateX(24px)",
          opacity: open ? 1 : 0,
          transition: "transform 160ms ease, opacity 160ms ease",
          overflow: "hidden",
        }}
      >
        <div style={{ height: "100%", overflow: "auto", padding: 12 }}>{children}</div>
      </div>
    </div>
  );
}
