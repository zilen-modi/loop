"use client";

import { ChevronLeft, ChevronRight, Pause, Play, Route, ShieldAlert } from "lucide-react";
import { catalog, type NodeKind } from "@/lib/design/catalog";
import { fmtPct, type SimResult } from "@/lib/design/engine";

export type DrillStep = { kind: NodeKind; note: string; sim: SimResult };

/** Traffic from a quiet hour up to the peak; the canvas updates as it moves. */
export function TrafficSlider({ scale, onScale, label }: { scale: number; onScale: (v: number) => void; label: string }) {
  return (
    <label className="lab-traffic">
      <span className="kicker" style={{ margin: 0 }}>Traffic</span>
      <input type="range" min={1} max={10} step={1} value={Math.round(scale * 10)} onChange={(e) => onScale(+e.target.value / 10)} aria-label="Traffic, as a share of peak" aria-valuetext={label} />
      <span className="lab-traffic-value" data-testid="traffic">{label}</span>
    </label>
  );
}

export function TraceButton({ running, onTrace, disabled }: { running: boolean; onTrace: () => void; disabled: boolean }) {
  return (
    <button className="btn small" onClick={onTrace} disabled={disabled} aria-pressed={running}>
      <Route size={14} aria-hidden="true" /> {running ? "Tracing…" : "Trace a request"}
    </button>
  );
}

/** One step of the failure drill: what fails, and what that does. */
export function stepLine(step: DrillStep, primary: string[]) {
  const broken = primary.map((id) => step.sim.flows[id]).find((f) => f && !f.ok);
  const b = step.sim.bottleneck;
  return broken ? broken.reason ?? "Something stops working." : `Still works${b ? `; busiest: ${catalog[b.kind].short} at ${fmtPct(b.utilization)}` : ""}.`;
}

/** Step through every single-machine failure, on the canvas. */
export function Drill({
  steps,
  index,
  playing,
  primary,
  onIndex,
  onPlay,
  onExit,
}: {
  steps: DrillStep[];
  index: number;
  playing: boolean;
  primary: string[];
  onIndex: (i: number) => void;
  onPlay: () => void;
  onExit: () => void;
}) {
  const ok = (st: DrillStep) => primary.every((id) => st.sim.flows[id]?.ok);
  const survived = steps.filter(ok).length;
  const firstBad = steps.find((st) => !ok(st));
  const step = steps[index];
  return (
    <div className="lab-drill" role="region" aria-label="Failure drill">
      <div className="lab-drill-head">
        <ShieldAlert size={16} aria-hidden="true" />
        <strong>Failure drill</strong>
        <span className="lab-drill-sum" data-testid="drill-summary">
          {survived === steps.length ? `${survived}/${steps.length} survived` : `${survived}/${steps.length} survived · first problem: ${catalog[firstBad!.kind].short}`}
        </span>
        <span style={{ flex: 1 }} />
        <button className="icon-btn" aria-label="Previous failure" onClick={() => onIndex(Math.max(0, index - 1))} disabled={index === 0}><ChevronLeft size={16} /></button>
        <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 13 }}>{index + 1} / {steps.length}</span>
        <button className="icon-btn" aria-label="Next failure" onClick={() => onIndex(Math.min(steps.length - 1, index + 1))} disabled={index === steps.length - 1}><ChevronRight size={16} /></button>
        <button className="icon-btn" aria-label={playing ? "Pause the drill" : "Play the drill"} onClick={onPlay}>{playing ? <Pause size={16} /> : <Play size={16} />}</button>
        <button className="btn small" onClick={onExit}>Done</button>
      </div>
      {step && (
        <p className={`lab-drill-line ${ok(step) ? "pass" : "fail"}`} data-testid="drill-line" aria-live="polite">
          <strong>{step.note}</strong> {stepLine(step, primary)}
        </p>
      )}
    </div>
  );
}
