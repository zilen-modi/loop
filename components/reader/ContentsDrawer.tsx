"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function ContentsDrawer({ sections, current, onGo, onClose }: { sections: { el: Element; title: string; page: number }[]; current: number; onGo: (el: Element) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button")?.focus();
  }, []);
  const active = sections.reduce((a, s, i) => (s.page <= current ? i : a), 0);
  return (
    <aside ref={ref} className="drawer" aria-label="Contents" data-interactive>
      <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", borderBottom: "1px solid var(--rule)" }}>
        <strong style={{ fontWeight: 500, flex: 1 }}>Contents</strong>
        <button className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button>
      </div>
      <nav style={{ overflow: "auto", padding: "6px 8px 20px" }}>
        {sections.map((s, i) => (
          <button
            key={i}
            onClick={() => onGo(s.el)}
            aria-current={i === active ? "true" : undefined}
            style={{ all: "unset", cursor: "pointer", display: "flex", gap: 10, width: "calc(100% - 16px)", padding: "10px 8px", borderRadius: 8, background: i === active ? "var(--page-2)" : undefined }}
          >
            <span style={{ flex: 1, fontFamily: "var(--serif)", fontSize: 15 }}>{s.title}</span>
            <span style={{ color: "var(--ink-3)", fontSize: 12 }}>p. {s.page}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
