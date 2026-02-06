import { useEffect, useMemo, useRef, useState } from "react";

export type CommandItem = {
  id: string;
  title: string;
  subtitle?: string | null;
};

type Props = {
  open: boolean;
  title?: string;
  items: CommandItem[];
  onClose: () => void;
  onSelect: (id: string) => void;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function CommandPalette({ open, title = "Sök nod", items, onClose, onSelect }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 120);

    const scored = items
      .map((it) => {
        const t = String(it.title ?? "").toLowerCase();
        const s = String(it.subtitle ?? "").toLowerCase();

        let score = 0;
        if (t === q) score += 1000;
        if (t.startsWith(q)) score += 500;
        if (t.includes(q)) score += 250;
        if (s.includes(q)) score += 80;

        return { it, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.it);

    return scored.slice(0, 120);
  }, [items, query]);

  useEffect(() => {
    if (!open) return;

    setQuery("");
    setActiveIndex(0);

    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => clamp(i + 1, 0, Math.max(0, filtered.length - 1)));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => clamp(i - 1, 0, Math.max(0, filtered.length - 1)));
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const it = filtered[activeIndex];
        if (it) onSelect(it.id);
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, filtered, activeIndex, onClose, onSelect]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    const row = el.querySelector(`[data-idx="${activeIndex}"]`) as HTMLElement | null;
    if (!row) return;

    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    const viewTop = el.scrollTop;
    const viewBottom = viewTop + el.clientHeight;

    if (top < viewTop) el.scrollTop = top;
    else if (bottom > viewBottom) el.scrollTop = bottom - el.clientHeight;
  }, [open, activeIndex]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 9000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 90,
        paddingLeft: 16,
        paddingRight: 16,
      }}
      onWheelCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onTouchMoveCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--overlay-medium)",
          backdropFilter: "blur(6px)",
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          onClose();
        }}
      />

      <div
        style={{
          width: "min(760px, 100%)",
          position: "relative",
          borderRadius: 14,
          border: "1px solid var(--border-0)",
          background: "var(--panel-bg)",
          boxShadow: "var(--shadow-soft)",
          overflow: "hidden",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <style>{`
          .cmdp-list::-webkit-scrollbar { width: 10px; }
          .cmdp-list::-webkit-scrollbar-track { background: var(--panel-subtle-bg); border-radius: 999px; }
          .cmdp-list::-webkit-scrollbar-thumb { background: var(--shadow-elev-1); border-radius: 999px; }
          .cmdp-list::-webkit-scrollbar-thumb:hover { background: var(--panel-border-2); }
        `}</style>

        <div style={{ padding: 14, borderBottom: "1px solid var(--border-0)" }}>
          <div style={{ fontSize: 12, color: "var(--panel-text-2)" }}>{title}</div>

          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Sök… (Enter för att välja)"
            style={{
              width: "100%",
              height: 42,
              marginTop: 10,
              borderRadius: 12,
              border: "1px solid var(--border-0)",
              background: "var(--panel-bg-2)",
              color: "var(--panel-text)",
              paddingLeft: 12,
              paddingRight: 12,
              outline: "none",
              boxShadow: "inset 0 1px 0 var(--panel-subtle-bg)",
            }}
          />
        </div>

        <div ref={listRef} className="cmdp-list" style={{ maxHeight: 480, overflow: "auto", padding: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 12, color: "var(--panel-text-2)" }}>Inga träffar</div>
          ) : (
            filtered.map((it, idx) => {
              const active = idx === activeIndex;
              return (
                <div
                  key={it.id}
                  data-idx={idx}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(it.id);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 10px",
                    borderRadius: 12,
                    cursor: "pointer",
                    background: active ? "var(--info-bg)" : "transparent",
                    border: active ? "1px solid var(--info-border)" : "1px solid transparent",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ color: "var(--panel-text)", fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>
                      {it.title}
                    </div>
                    {it.subtitle ? (
                      <div style={{ color: "var(--panel-text-2)", fontSize: 12, marginTop: 2 }}>{it.subtitle}</div>
                    ) : null}
                  </div>
                  <div style={{ color: "var(--panel-text-2)", fontSize: 12 }}>⏎</div>
                </div>
              );
            })
          )}
        </div>

        <div
          style={{
            borderTop: "1px solid var(--border-0)",
            background: "var(--panel-bg)",
            padding: "10px 12px",
            display: "flex",
            justifyContent: "space-between",
            color: "var(--panel-text-2)",
            fontSize: 12,
          }}
        >
          <span>Esc: stäng</span>
          <span>↑/↓: navigera</span>
        </div>
      </div>
    </div>
  );
}
