"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { X } from "lucide-react";
import { catalog, type NodeKind } from "@/lib/design/catalog";
import { fmtPct, fmtRate } from "@/lib/design/engine";
import { categoryColor, kindIcon, stateColor, stateOf, useLab } from "./visuals";

export type BoxData = { kind: NodeKind; count: number };
export type BoxNode = Node<BoxData, "box">;

/** A load ring: how busy the component is, from 0 to 100% (it caps the arc at full). */
function Ring({ u, color }: { u: number; color: string }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <svg width="40" height="40" viewBox="0 0 44 44" aria-hidden="true" className="lab-ring">
      <circle cx="22" cy="22" r={r} fill="none" stroke="var(--rule)" strokeWidth="3.5" />
      <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${Math.min(1, u) * c} ${c}`} transform="rotate(-90 22 22)" />
      <text x="22" y="26" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--ink)" style={{ fontVariantNumeric: "tabular-nums" }}>
        {u >= 10 ? "999+" : Math.round(u * 100)}
      </text>
    </svg>
  );
}

export default function NodeCard({ data, selected }: NodeProps<BoxNode>) {
  const live = useLab();
  const spec = catalog[data.kind];
  const Icon = kindIcon[data.kind];
  const failed = live.failed === data.kind;
  const u = live.util[data.kind];
  const state = data.kind === "client" ? "idle" : stateOf(u, failed);
  const tput = live.throughput[data.kind];
  const dim = live.highlight && !live.highlight.has(data.kind);
  const traced = live.trace?.kind === data.kind;
  const stack = data.count > 2 ? 3 : data.count > 1 ? 2 : 1;
  const label =
    data.kind === "client"
      ? "Users: peak traffic"
      : `${spec.label}, ${data.count} machine${data.count === 1 ? "" : "s"}${u !== undefined ? `, ${fmtPct(u)} busy` : ""}${failed ? ", failed" : ""}`;
  return (
    <div
      className={`lab-node${selected ? " selected" : ""}${dim ? " dim" : ""}${traced ? " traced" : ""}`}
      data-kind={data.kind}
      data-state={state}
      data-stack={stack}
      style={{ "--cat": categoryColor[spec.category], "--state": stateColor[state] } as React.CSSProperties}
      aria-label={label}
      title={label}
    >
      <Handle type="target" position={Position.Left} />
      <span className="lab-node-icon" aria-hidden="true"><Icon size={18} /></span>
      <span className="lab-node-text">
        <span className="lab-node-name">{spec.short}</span>
        <span className="lab-node-sub">
          {data.kind === "client" ? "peak traffic" : `×${data.count}`}
          {tput ? ` · ${fmtRate(tput)}` : ""}
        </span>
      </span>
      {data.kind !== "client" && <Ring u={failed ? 0 : (u ?? 0)} color={stateColor[state]} />}
      {failed && <span className="lab-node-x" aria-hidden="true"><X size={22} /></span>}
      {traced && live.trace && <span className="lab-node-trace">+{live.trace.ms.toFixed(1)} ms</span>}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
