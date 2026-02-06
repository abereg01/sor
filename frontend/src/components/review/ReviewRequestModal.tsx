import { useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { isTypingTarget } from "@/lib/dom";

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  initialText?: string;
  busy?: boolean;
  onSubmit: (description: string) => void | Promise<void>;
  onClose: () => void;
};


export function ReviewRequestModal({
  open,
  title,
  subtitle,
  initialText = "",
  busy = false,
  onSubmit,
  onClose,
}: Props) {
  const [text, setText] = useState(initialText);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setText(initialText);
    setTouched(false);
  }, [open, initialText]);

  const trimmed = useMemo(() => text.trim(), [text]);
  const canSubmit = trimmed.length >= 3 && !busy;

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }

      if ((e.key === "Enter" && (e.metaKey || e.ctrlKey)) || (e.key === "Enter" && e.altKey)) {
        if (!canSubmit) return;
        e.preventDefault();
        e.stopPropagation();
        onSubmit(trimmed);
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, canSubmit, onClose, onSubmit, trimmed]);

  if (!open) return null;

  const hint =
    trimmed.length < 3
      ? "Skriv en kort beskrivning (minst 3 tecken)."
      : "Tips: Ctrl/⌘ + Enter skickar.";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={onClose}
        className="modal-overlay"
        style={{
          position: "absolute",
          inset: 0,
        }}
      />

      <div
        className="panel-light modal-surface"
        role="dialog"
        aria-modal="true"
        style={{
          position: "relative",
          width: "min(720px, calc(100vw - 32px))",
          borderRadius: 14,
          boxShadow: "var(--shadow-soft)",
          background: "var(--modal-surface-bg)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "12px 14px",
            borderBottom: "1px solid var(--panel-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: "var(--panel-text)", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
              {title}
            </div>
            {subtitle ? (
              <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                {subtitle}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              border: "1px solid var(--panel-border)",
              background: "var(--panel-bg)",
              borderRadius: 10,
              padding: "6px 10px",
              cursor: "pointer",
              color: "var(--panel-text)",
              fontWeight: 600,
              flexShrink: 0,
            }}
            title="Stäng"
          >
            <X size={16} /> Esc
          </button>
        </div>

        <div style={{ padding: "12px 14px" }}>
          <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 600, marginBottom: 8 }}>Beskrivning</div>
          <textarea
            rows={6}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setTouched(true);
            }}
            placeholder="Varför behövs granskning? Vad ska kontrolleras, och av vem/var?"
            style={{ width: "100%", resize: "vertical" }}
            autoFocus
          />
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--panel-muted)", fontWeight: 400 }}>
            {touched ? hint : "Skriv en kort förklaring så blir ärendet lätt att plocka upp."}
          </div>
        </div>

        <div
          style={{
            padding: "12px 14px",
            borderTop: "1px solid var(--panel-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ fontSize: 12, color: "var(--panel-muted)", fontWeight: 400 }}>
            Status blir <code>Behöver granskning</code>.
          </div>

          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              onSubmit(trimmed);
              onClose();
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid var(--panel-border)",
              background: canSubmit ? "var(--info-bg)" : "var(--panel-subtle-border)",
              color: "var(--panel-text)",
              fontWeight: 600,
              cursor: canSubmit ? "pointer" : "not-allowed",
              opacity: canSubmit ? 1 : 0.7,
            }}
            title={canSubmit ? "Skicka till granskning" : "Beskrivning krävs"}
          >
            <Check size={16} />
            Skicka till granskning
          </button>
        </div>
      </div>
    </div>
  );
}

export default ReviewRequestModal;
