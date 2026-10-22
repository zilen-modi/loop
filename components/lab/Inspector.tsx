"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Minus, Plus, Trash2, X } from "lucide-react";
import { catalog, type NodeKind } from "@/lib/design/catalog";
import { fmtPct, fmtRate } from "@/lib/design/engine";
import { categoryColor, kindIcon, stateColor, stateOf } from "./visuals";

type Props = {
  kind: NodeKind;
  count: number;
  util?: number;
  throughput?: number;
  /** Where the selected box is on screen, relative to the canvas. */
  anchor: { x: number; y: number; w: number; h: number } | null;
  bounds: { w: number; h: number };
  others: NodeKind[];
  links: NodeKind[];
  onCount: (c: number) => void;
  onLink: (k: NodeKind) => void;
  onUnlink: (k: NodeKind) => void;
  onRemove: () => void;
  onClose: () => void;
};

/** Settings for the selected box, floating beside it and kept on screen. */
export default function Inspector(p: Props) {
  const spec = catalog[p.kind];
  const Icon = kindIcon[p.kind];
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const fixed = spec.fixedCount !== undefined;
  const state = stateOf(p.util, false);
  const unlinked = p.others.filter((k) => !p.links.includes(k));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !p.anchor) return setPos(null);
    const w = el.offsetWidth, h = el.offsetHeight, gap = 14, pad = 8;
    let left = p.anchor.x + p.anchor.w + gap;
    if (left + w > p.bounds.w - pad) left = p.anchor.x - w - gap; // flip to the left side
    left = Math.max(pad, Math.min(left, p.bounds.w - w - pad));
    const top = Math.max(pad, Math.min(p.anchor.y + p.anchor.h / 2 - h / 2, p.bounds.h - h - pad));
    setPos({ left, top });
  }, [p.anchor, p.bounds, p.kind, p.count, p.links.length]);

  // Focus moves in when it opens; Escape closes it.
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
  }, [p.kind]);

  return (
    <div
      ref={ref}
      className="lab-inspector"
      role="dialog"
      aria-label={`${spec.label} settings`}
      data-overlay
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? 0, "--cat": categoryColor[spec.category] } as React.CSSProperties}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          p.onClose();
        }
      }}
    >
      <div className="lab-inspector-head">
        <span className="lab-node-icon" aria-hidden="true"><Icon size={18} /></span>
        <strong>{spec.label}</strong>
        <button className="icon-btn" aria-label="Close settings" onClick={p.onClose}><X size={16} /></button>
      </div>
      <p className="lab-inspector-note">{spec.note}</p>

      {p.kind !== "client" && (
        <>
          {!fixed ? (
            <div className="lab-count">
              <span className="kicker" style={{ margin: 0 }}>Machines</span>
              <div className="lab-count-row">
                <button className="icon-btn" aria-label="Fewer machines" onClick={() => p.onCount(p.count - 1)} disabled={p.count <= 1}>
                  <Minus size={15} />
                </button>
                <input type="range" min={1} max={spec.maxCount} value={p.count} onChange={(e) => p.onCount(+e.target.value)} aria-label="Machines" data-autofocus />
                <button className="icon-btn" aria-label="More machines" onClick={() => p.onCount(p.count + 1)} disabled={p.count >= spec.maxCount}>
                  <Plus size={15} />
                </button>
                <output className="lab-count-value" data-testid="count" aria-live="polite">{p.count}</output>
              </div>
            </div>
          ) : (
            <p className="lab-inspector-note">{spec.external ? "Run by someone else: you can't add machines." : "One of these per design."}</p>
          )}
          <div className="lab-meter-row">
            <div className="lab-meter" aria-hidden="true"><span style={{ width: `${Math.min(100, (p.util ?? 0) * 100)}%`, background: stateColor[state] }} /></div>
            <span style={{ color: stateColor[state], fontVariantNumeric: "tabular-nums" }}>{p.util !== undefined ? `${fmtPct(p.util)} busy` : "idle"}</span>
          </div>
          <p className="lab-inspector-note" style={{ marginTop: 2 }}>
            {p.throughput ? `${fmtRate(p.throughput)} at peak · ` : ""}
            {spec.costPerMonth ? `$${(spec.costPerMonth * p.count).toLocaleString("en-US")}/mo (${p.count} × $${spec.costPerMonth})` : "No monthly cost here"}
          </p>
        </>
      )}

      <div className="lab-links">
        <span className="kicker" style={{ margin: 0 }}>Links</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {p.links.map((k) => (
            <button key={k} className="chip lab-link-chip" onClick={() => p.onUnlink(k)} aria-label={`Remove link to ${catalog[k].label}`}>
              ↔ {catalog[k].short} <X size={12} aria-hidden="true" />
            </button>
          ))}
          {!p.links.length && <span style={{ color: "var(--ink-3)", fontSize: 13 }}>None yet</span>}
        </div>
        {unlinked.length > 0 && (
          <select aria-label="Link to" value="" onChange={(e) => e.target.value && p.onLink(e.target.value as NodeKind)} className="lab-select" data-autofocus={p.kind === "client" || fixed ? true : undefined}>
            <option value="">Link to…</option>
            {unlinked.map((k) => <option key={k} value={k}>{catalog[k].label}</option>)}
          </select>
        )}
      </div>

      {p.kind !== "client" && (
        <button className="btn small lab-remove" onClick={p.onRemove}><Trash2 size={14} /> Remove {spec.short}</button>
      )}
    </div>
  );
}
