"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Highlighter, NotebookPen, Trash2 } from "lucide-react";
import type { Highlight } from "@/lib/progress";

export type SelectionState =
  | { kind: "new"; block: number; start: number; end: number; text: string; rect: DOMRect }
  | { kind: "existing"; highlight: Highlight; rect: DOMRect };

/** Appears over selected text (or a tapped highlight): highlight, add a note, or remove. */
export default function SelectionMenu({
  state,
  onHighlight,
  onRemove,
  onNote,
  onClose,
}: {
  state: SelectionState;
  onHighlight: (note?: string) => void;
  onRemove: (id: string) => void;
  onNote: (id: string, note: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [writing, setWriting] = useState(state.kind === "existing" && !!state.highlight.note);
  const [note, setNoteText] = useState(state.kind === "existing" ? (state.highlight.note ?? "") : "");
  const [pos, setPos] = useState({ left: state.rect.left, top: state.rect.top - 52 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = Math.min(Math.max(12, state.rect.left + state.rect.width / 2 - w / 2), window.innerWidth - w - 12);
    const top = state.rect.top - h - 10 > 12 ? state.rect.top - h - 10 : state.rect.bottom + 10;
    setPos({ left, top });
  }, [state.rect, writing]);

  useEffect(() => {
    const off = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const t = setTimeout(() => window.addEventListener("pointerdown", off), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", off);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="popover" role="dialog" aria-label="Highlight" style={{ left: pos.left, top: pos.top, width: writing ? 300 : "auto", padding: 6 }} data-interactive>
      {!writing ? (
        <div style={{ display: "flex", gap: 2 }}>
          {state.kind === "new" ? (
            <button className="btn small" style={{ border: 0 }} onClick={() => onHighlight()} autoFocus>
              <Highlighter size={15} /> Highlight
            </button>
          ) : (
            <button className="btn small" style={{ border: 0 }} onClick={() => onRemove(state.highlight.id)} autoFocus>
              <Trash2 size={15} /> Remove
            </button>
          )}
          <button className="btn small" style={{ border: 0 }} onClick={() => setWriting(true)}>
            <NotebookPen size={15} /> {state.kind === "existing" && state.highlight.note ? "Edit note" : "Note"}
          </button>
        </div>
      ) : (
        <form
          style={{ display: "grid", gap: 8, padding: 6 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (state.kind === "new") onHighlight(note.trim() || undefined);
            else onNote(state.highlight.id, note.trim());
          }}
        >
          <label className="kicker" htmlFor="hl-note">Your note</label>
          <textarea
            id="hl-note"
            value={note}
            onChange={(e) => setNoteText(e.target.value)}
            rows={3}
            autoFocus
            placeholder="Why this matters to you"
            style={{ font: "14px var(--sans)", padding: 8, borderRadius: 8, border: "1px solid var(--rule-2)", background: "var(--page)", color: "var(--ink)", resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button type="button" className="btn small" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn small primary">Save</button>
          </div>
        </form>
      )}
    </div>
  );
}
