"use client";

import { useState } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { catalog, type NodeKind } from "@/lib/design/catalog";
import { fmtLatency, fmtPct, type SimResult } from "@/lib/design/engine";
import type { Design } from "@/lib/design/graph";
import type { CheckResult, DesignScenario } from "@/lib/design/evaluate";
import { categoryColor } from "./visuals";

const tone = (u: number) => (u >= 1 ? "var(--fail)" : u > 0.7 ? "var(--warn)" : "var(--ink)");

/** Live stat tiles: the scenario's key flows, cost and the busiest box. */
export function Tiles({ s, sim }: { s: DesignScenario; sim: SimResult }) {
  return (
    <div className="lab-tiles" aria-label="Live estimate">
      {s.metrics.map((m) => {
        const f = sim.flows[m.flow];
        return (
          <div key={m.flow} className="lab-tile" data-testid={`tile-${m.flow}`}>
            <span className="kicker">{m.label}</span>
            <strong style={{ color: f?.ok ? "var(--ink)" : "var(--fail)" }}>{f?.ok ? fmtLatency(f.latencyMs) : "fails"}</strong>
          </div>
        );
      })}
      <div className="lab-tile" data-testid="tile-cost">
        <span className="kicker">Cost</span>
        <strong>${sim.costPerMonth.toLocaleString("en-US")}<small>/mo</small></strong>
      </div>
      <div className="lab-tile">
        <span className="kicker">Busiest</span>
        <strong style={{ color: sim.bottleneck ? tone(sim.bottleneck.utilization) : "var(--ink-3)" }}>
          {sim.bottleneck ? `${catalog[sim.bottleneck.kind].short} ${fmtPct(sim.bottleneck.utilization)}` : "—"}
        </strong>
      </div>
    </div>
  );
}

/** Where the time goes on the slow path, hop by hop. */
export function HopBar({ s, sim }: { s: DesignScenario; sim: SimResult }) {
  const m = s.metrics[0];
  const f = sim.flows[m.flow];
  if (!f?.ok || !f.hops.length) return null;
  return (
    <div className="lab-breakdown">
      <p className="kicker" style={{ margin: "0 0 6px" }}>{m.label} · {fmtLatency(f.latencyMs)}, hop by hop</p>
      <div className="lab-stack" role="img" aria-label={f.hops.map((h) => `${catalog[h.kind].short} ${h.ms.toFixed(1)} ms`).join(", ")}>
        {f.hops.map((h, i) => (
          <span key={i} className="lab-seg" data-hop={h.kind} data-ms={h.ms} style={{ flexGrow: Math.max(h.ms, 0.01), background: categoryColor[catalog[h.kind].category] }} title={`${catalog[h.kind].label}: ${h.ms.toFixed(1)} ms`} />
        ))}
      </div>
      <div className="lab-legend">
        {f.hops.map((h, i) => (
          <span key={i}><i style={{ background: categoryColor[catalog[h.kind].category] }} />{catalog[h.kind].short} {h.ms.toFixed(1)}</span>
        ))}
      </div>
    </div>
  );
}

/** Monthly cost by component. */
export function CostBar({ design }: { design: Design }) {
  const parts = design.nodes.filter((n) => n.kind !== "client" && catalog[n.kind].costPerMonth > 0).map((n) => ({ kind: n.kind, cost: catalog[n.kind].costPerMonth * n.count }));
  const total = parts.reduce((t, p) => t + p.cost, 0);
  if (!total) return null;
  return (
    <div className="lab-breakdown">
      <p className="kicker" style={{ margin: "0 0 6px" }}>Cost · ${total.toLocaleString("en-US")} a month</p>
      <div className="lab-stack" role="img" aria-label={parts.map((p) => `${catalog[p.kind].short} $${p.cost}`).join(", ")}>
        {parts.map((p) => (
          <span key={p.kind} className="lab-seg" data-cost={p.cost} style={{ flexGrow: p.cost, background: categoryColor[catalog[p.kind].category] }} title={`${catalog[p.kind].label}: $${p.cost}`} />
        ))}
      </div>
      <div className="lab-legend">
        {parts.map((p) => (
          <span key={p.kind}><i style={{ background: categoryColor[catalog[p.kind].category] }} />{catalog[p.kind].short} ${p.cost.toLocaleString("en-US")}</span>
        ))}
      </div>
    </div>
  );
}

/** The scorecard: one pill per requirement; hovering or focusing one lights up its part of the canvas. */
export function Scorecard({
  checks,
  stale,
  onFocus,
}: {
  checks: (CheckResult & { short: string; focus: NodeKind[] })[];
  stale: boolean;
  onFocus: (kinds: NodeKind[] | null) => void;
}) {
  const [open, setOpen] = useState<string | null>(() => checks.find((c) => !c.pass)?.id ?? null);
  const passed = checks.filter((c) => c.pass).length;
  const all = passed === checks.length;
  const current = checks.find((c) => c.id === open);
  return (
    <div className="lab-score">
      <div className="lab-score-head">
        <span className={`lab-score-num${all ? " pass" : ""}`} role="status" data-testid="score">
          {passed} / {checks.length}
        </span>
        <span>{all ? "Every requirement met. Solid design." : "requirements met"}</span>
        {stale && (
          <span className="lab-stale"><AlertTriangle size={14} aria-hidden="true" /> Design changed since. Simulate again.</span>
        )}
      </div>
      <div className="lab-pills" role="group" aria-label="Requirements">
        {checks.map((c) => (
          <button
            key={c.id}
            className={`lab-pill${c.pass ? " pass" : " fail"}${open === c.id ? " open" : ""}`}
            aria-expanded={open === c.id}
            data-check={c.id}
            data-pass={c.pass}
            onClick={() => setOpen(open === c.id ? null : c.id)}
            onMouseEnter={() => onFocus(c.focus)}
            onMouseLeave={() => onFocus(null)}
            onFocus={() => onFocus(c.focus)}
            onBlur={() => onFocus(null)}
            title={c.label}
          >
            {c.pass ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
            {c.short}
          </button>
        ))}
      </div>
      {current && (
        <div className="lab-pill-detail" data-detail={current.id}>
          <strong>{current.label}</strong>
          <span>{current.detail}</span>
        </div>
      )}
    </div>
  );
}
