"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { concepts } from "@/content/concepts";
import ConceptGlyph from "@/components/ui/ConceptGlyph";

/** Kindle's X-Ray, for concepts: what it means, its glyph, and where else it shows up. */
export default function XRayPopover({ id, rect, onClose }: { id: string; rect: DOMRect; onClose: () => void }) {
  const c = concepts[id];
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: rect.left, top: rect.bottom + 8 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - w / 2), window.innerWidth - w - 12);
    const below = rect.bottom + 8 + h < window.innerHeight - 12;
    setPos({ left, top: below ? rect.bottom + 8 : Math.max(12, rect.top - h - 8) });
  }, [rect]);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    const off = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest(".term") && onClose();
    window.addEventListener("pointerdown", off);
    return () => window.removeEventListener("pointerdown", off);
  }, [onClose]);

  if (!c) return null;
  return (
    <div ref={ref} className="popover" role="dialog" aria-label={`${c.term} explained`} style={{ left: pos.left, top: pos.top }} data-interactive>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <ConceptGlyph concept={c} size={30} />
        <strong style={{ fontWeight: 600, flex: 1 }}>{c.term}</strong>
        <button className="icon-btn" aria-label="Close" onClick={onClose} style={{ width: 30, height: 30 }}><X size={16} /></button>
      </div>
      <p style={{ margin: "0 0 10px", fontFamily: "var(--serif)", fontSize: 15, lineHeight: 1.6 }}>{c.definition}</p>
      <p className="kicker" style={{ margin: "0 0 4px" }}>Also appears in</p>
      <ul style={{ margin: 0, paddingLeft: 18, color: "var(--ink-2)", fontSize: 13 }}>
        {c.appearsIn.map((a) => <li key={a}>{a}</li>)}
      </ul>
    </div>
  );
}
