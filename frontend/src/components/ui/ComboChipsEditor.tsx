import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

export type ComboLookupItem = { id: string; name: string };

type Props = {
  label: string;
  placeholder?: string;
  values: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  lookup: (q: string) => Promise<ComboLookupItem[]>;
  single?: boolean;
};

function normalizeList(items: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of items) {
    const s = String(raw ?? "").trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

export function ComboChipsEditor({ label, placeholder, values, onChange, disabled, lookup, single }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ComboLookupItem[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<number | null>(null);

  const normalizedValues = useMemo(() => normalizeList(values), [values]);
  const isFull = Boolean(single) && normalizedValues.length >= 1;

  useEffect(() => {
    function onDocDown(e: Event) {
      const t = e.target as Node | null;
      if (!t) return;
      if (!boxRef.current) return;
      if (boxRef.current.contains(t)) return;
      setOpen(false);
    }

    document.addEventListener("mousedown", onDocDown, true);
    document.addEventListener("touchstart", onDocDown, true);
    return () => {
      document.removeEventListener("mousedown", onDocDown, true);
      document.removeEventListener("touchstart", onDocDown, true);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await lookup(query);
        setItems(res);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [open, query, lookup]);

  function removeValue(v: string) {
    onChange(normalizeList(normalizedValues.filter((x) => x.toLowerCase() !== v.toLowerCase())));
  }

  function addValue(v: string) {
    const next = single ? normalizeList([v]) : normalizeList([...normalizedValues, v]);
    onChange(next);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (isFull) return;

    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const v = query.trim();
      if (v) addValue(v);
    }

    if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const filteredSuggestions = useMemo(() => {
    const existing = new Set(normalizedValues.map((v) => v.toLowerCase()));
    return items.filter((it) => !existing.has(it.name.toLowerCase()));
  }, [items, normalizedValues]);

  return (
    <div ref={boxRef} style={{ display: "flex", flexDirection: "column", gap: 8, position: "relative" }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--panel-text-2)" }}>{label}</div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          padding: 10,
          borderRadius: 12,
          border: "1px solid var(--panel-border)",
          background: "var(--panel-bg)",
          opacity: disabled ? 0.65 : 1,
        }}
      >
        {normalizedValues.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
            {normalizedValues.map((v) => (
              <div
                key={v.toLowerCase()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "6px 8px",
                  borderRadius: 10,
                  border: "1px solid var(--panel-subtle-border)",
                  background: "var(--panel-subtle-bg)",
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
                <button type="button" disabled={disabled} onClick={() => removeValue(v)} style={{ opacity: 0.85 }}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {!isFull ? (

        <input
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          style={{
            border: "none",
            outline: "none",
            background: "var(--panel-bg)",
            minWidth: 220,
            flex: 1,
            fontWeight: 400,
          }}
        />
        ) : null}
      </div>

      {open && !disabled && (
        <div
          style={{
            background: "var(--panel-bg)",
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 50,
            borderRadius: 12,
            border: "1px solid var(--panel-border)",
            boxShadow: "var(--shadow-soft)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--panel-border)", fontSize: 12, fontWeight: 600, color: "var(--panel-text)", background: "var(--panel-bg)" }}>
            {loading ? "Söker…" : filteredSuggestions.length ? "Förslag" : "Inga förslag"}
          </div>

          <div style={{ maxHeight: 160, overflow: "auto" }}>
            {filteredSuggestions.slice(0, 20).map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => addValue(it.name)}
                onMouseEnter={() => setHoveredId(it.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 10px",
                  border: "none",
                  background: hoveredId === it.id ? "var(--panel-subtle-bg)" : "white",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {it.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
