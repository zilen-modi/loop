"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import type { NodeKind } from "@/lib/design/catalog";
import { fmtRate } from "@/lib/design/engine";
import { rateKey } from "@/lib/design/graph";
import { useLab } from "./visuals";

const lg = (r: number) => Math.log10(Math.max(1, r));

/** Moving dots along a path: more and faster dots for busier links. */
function Dots({ path, rate, reverse }: { path: string; rate: number; reverse?: boolean }) {
  const n = Math.max(1, Math.min(5, Math.round(lg(rate))));
  const dur = Math.max(0.9, 3.4 - lg(rate) * 0.55);
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} r="2.6" className="lab-dot">
          <animateMotion dur={`${dur}s`} begin={`${(-i * dur) / n}s`} repeatCount="indefinite" path={path} keyPoints={reverse ? "1;0" : "0;1"} keyTimes="0;1" calcMode="linear" />
        </circle>
      ))}
    </>
  );
}

/** A link with live traffic: width and dots scale with requests per second, red when it feeds an overloaded box. */
export default function FlowEdge({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected }: EdgeProps) {
  const live = useLab();
  const [path, lx, ly] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const fwd = live.rates[rateKey(source as NodeKind, target as NodeKind)] ?? 0;
  const back = live.rates[rateKey(target as NodeKind, source as NodeKind)] ?? 0;
  const total = fwd + back;
  const into = (k: string) => (live.util[k as NodeKind] ?? 0) >= 1;
  const hot = (fwd > 0 && into(target)) || (back > 0 && into(source));
  const failedEnd = live.failed === source || live.failed === target;
  const dim = live.highlight && !(live.highlight.has(source as NodeKind) && live.highlight.has(target as NodeKind));
  const short = Math.abs(targetX - sourceX) < 90 && Math.abs(targetY - sourceY) < 40; // lift the label clear of the boxes
  const width = total > 0 ? 1.5 + Math.min(3.5, lg(total) * 0.8) : 1.5;
  const color = selected ? "var(--accent)" : failedEnd ? "var(--ink-3)" : hot ? "var(--fail)" : total > 0 ? "var(--ink-2)" : "var(--rule-2)";
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        className={`lab-edge${dim ? " dim" : ""}`}
        style={{ stroke: color, strokeWidth: width, strokeDasharray: total > 0 && !failedEnd ? undefined : "5 5", opacity: dim ? 0.25 : 1 }}
        interactionWidth={18}
      />
      {!live.reducedMotion && !dim && !failedEnd && (
        <g style={{ color: hot ? "var(--fail)" : "var(--accent)" }}>
          {fwd > 0 && <Dots path={path} rate={fwd} />}
          {back > 0 && <Dots path={path} rate={back} reverse />}
        </g>
      )}
      {total > 0 && !dim && (
        <EdgeLabelRenderer>
          <div className={`lab-rate${hot ? " hot" : ""}`} style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly - (short ? 36 : 0)}px)` }} data-edge={`${source}-${target}`}>
            {fmtRate(total)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
