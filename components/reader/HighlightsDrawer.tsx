"use client";

import { useEffect, useRef } from "react";
import { Trash2, X } from "lucide-react";
import type { Highlight } from "@/lib/progress";

export default function HighlightsDrawer({ highlights, onGo, onRemove, onClose }: { highlights: Highlight[]; onGo: (h: Highlight) => void; onRemove: (id: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button")?.focus();
  }, []);
  const sorted = [...highlights].sort((a, b) => a.block - b.block || a.start - b.start);
  return (
    <aside ref={ref} className="drawer" aria-label="Your highlights" data-interactive>
      <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", borderBottom: "1px solid var(--rule)" }}>
        <strong style={{ fontWeight: 500, flex: 1 }}>Your highlights</strong>
        <button className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button>
      </div>
      <div style={{ overflow: "auto", padding: "8px 14px 20px" }}>
        {!sorted.length && (
          <p style={{ color: "var(--ink-2)", lineHeight: 1.6 }}>Select any sentence while reading and choose Highlight. Each highlight also becomes a review card, so it comes back before you forget it.</p>
        )}
        {sorted.map((h) => (
          <div key={h.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--rule)" }}>
            <button onClick={() => onGo(h)} style={{ all: "unset", cursor: "pointer", display: "block", fontFamily: "var(--serif)", fontSize: 15, lineHeight: 1.55, borderLeft: "3px solid var(--hl)", paddingLeft: 10 }}>
              {h.text}
            </button>
            {h.note && <p style={{ margin: "6px 0 0 13px", color: "var(--ink-2)", fontSize: 13 }}>Note: {h.note}</p>}
            <button className="btn small" style={{ border: 0, marginTop: 4, marginLeft: 3, color: "var(--ink-3)" }} onClick={() => onRemove(h.id)}>
              <Trash2 size={14} /> Remove
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
