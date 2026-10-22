"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const ORDERS = [4, 9, 3, 8, 6, 2, 7, 5, 1, 6];

/** Step a window across a day's orders and watch the work each approach does. */
export default function WindowExplorer() {
  const [k, setK] = useState(3);
  const [start, setStart] = useState(0);
  const n = ORDERS.length;
  const maxStart = n - k;
  const s = Math.min(start, maxStart);
  const sum = ORDERS.slice(s, s + k).reduce((a, b) => a + b, 0);
  const windows = s + 1;
  const recountOps = windows * k;
  const slideOps = k + (windows - 1) * 2;
  const totalRecount = (n - k + 1) * k;
  const totalSlide = k + (n - k) * 2;

  return (
    <div className="figure" data-interactive>
      <p className="fig-label">Try it · orders per minute</p>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: 4, marginBottom: 6 }}>
        {ORDERS.map((v, i) => {
          const inside = i >= s && i < s + k;
          const entering = s > 0 && i === s + k - 1;
          const leaving = s > 0 && i === s - 1;
          return (
            <div key={i} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 15,
                  padding: "8px 0",
                  borderRadius: 6,
                  border: `1.5px solid ${inside ? "var(--accent)" : "var(--rule)"}`,
                  background: inside ? "var(--accent-soft)" : "transparent",
                  color: leaving ? "var(--ink-3)" : "var(--ink)",
                  textDecoration: leaving ? "line-through" : "none",
                }}
              >
                {v}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", height: 16 }}>{entering ? "in" : leaving ? "out" : ""}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <button className="btn small" aria-label="Move window left" onClick={() => setStart(Math.max(0, s - 1))} disabled={s === 0}><ChevronLeft size={15} /></button>
        <button className="btn small" aria-label="Move window right" onClick={() => setStart(Math.min(maxStart, s + 1))} disabled={s === maxStart}><ChevronRight size={15} /></button>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-2)" }}>
          k
          <input type="range" min={1} max={6} step={1} value={k} onChange={(e) => { setK(+e.target.value); setStart(0); }} aria-label="Window size k" />
          <span style={{ fontFamily: "var(--mono)", minWidth: 12 }}>{k}</span>
        </label>
        <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 13 }}>sum = {sum}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
        <div style={{ background: "var(--fail-soft)", color: "var(--fail)", borderRadius: 8, padding: "8px 10px" }}>
          <strong style={{ fontWeight: 600 }}>Recount</strong> · {recountOps} additions so far
          <div style={{ opacity: 0.85 }}>{totalRecount} for the whole day</div>
        </div>
        <div style={{ background: "var(--pass-soft)", color: "var(--pass)", borderRadius: 8, padding: "8px 10px" }}>
          <strong style={{ fontWeight: 600 }}>Slide</strong> · {slideOps} operations so far
          <div style={{ opacity: 0.85 }}>{totalSlide} for the whole day</div>
        </div>
      </div>
    </div>
  );
}
