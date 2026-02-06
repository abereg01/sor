import { useState } from "react";

type Props = {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

export function SidebarSection({
  title,
  defaultOpen = false,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="surface" style={{ marginBottom: 12 }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          cursor: "pointer",
          fontWeight: 600,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>{title}</span>
        <span style={{ opacity: 0.6 }}>{open ? "▾" : "▸"}</span>
      </div>

      {open && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  );
}
