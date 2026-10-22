"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { catalog, kindsInPalette, type Category, type NodeKind } from "@/lib/design/catalog";
import { fmtRate } from "@/lib/design/engine";
import { categoryColor, categoryLabel, kindIcon, laneOrder } from "./visuals";

export const DRAG_TYPE = "application/x-loop-kind";

/** Components grouped by category. Drag one onto the canvas, or click it to add it to its lane. */
export default function Palette({ onCanvas, onAdd }: { onCanvas: Set<NodeKind>; onAdd: (k: NodeKind) => void }) {
  const [q, setQ] = useState("");
  const match = (k: NodeKind) => `${catalog[k].label} ${catalog[k].short} ${catalog[k].note}`.toLowerCase().includes(q.trim().toLowerCase());
  const groups = laneOrder
    .filter((c) => c !== "users")
    .map((c) => ({ c, kinds: kindsInPalette.filter((k) => catalog[k].category === c && match(k)) }))
    .filter((g) => g.kinds.length);
  return (
    <aside className="lab-palette" aria-label="Components">
      <label className="lab-filter">
        <Search size={14} aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter components" aria-label="Filter components" />
      </label>
      <div className="lab-palette-groups">
        {groups.map(({ c, kinds }) => (
          <section key={c} className="lab-palette-group" aria-label={categoryLabel[c as Category]}>
            <p className="kicker" style={{ margin: "0 0 4px", color: categoryColor[c as Category] }}>{categoryLabel[c as Category]}</p>
            {kinds.map((k) => {
              const s = catalog[k];
              const Icon = kindIcon[k];
              const placed = onCanvas.has(k);
              return (
                // A div, not a <button>: Chrome won't start a drag from a form control.
                <div
                  key={k}
                  role="button"
                  tabIndex={0}
                  className={`lab-item${placed ? " placed" : ""}`}
                  draggable={!placed}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG_TYPE, k);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => !placed && onAdd(k)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !placed) {
                      e.preventDefault();
                      onAdd(k);
                    }
                  }}
                  aria-disabled={placed}
                  title={s.note}
                  data-kind={k}
                  style={{ "--cat": categoryColor[s.category] } as React.CSSProperties}
                >
                  <span className="lab-item-icon" aria-hidden="true"><Icon size={16} /></span>
                  <span className="lab-item-text">
                    <span className="lab-item-name">{s.label}</span>
                    <span className="lab-item-meta">{placed ? "On canvas" : `${fmtRate(s.capacity)} each · $${s.costPerMonth}/mo`}</span>
                  </span>
                </div>
              );
            })}
          </section>
        ))}
        {!groups.length && <p style={{ color: "var(--ink-3)", fontSize: 13, margin: "8px 4px" }}>No components match.</p>}
      </div>
    </aside>
  );
}
