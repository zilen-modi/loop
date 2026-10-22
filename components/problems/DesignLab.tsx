"use client";

import "@xyflow/react/dist/style.css";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  Background,
  ConnectionMode,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Activity, Check, ChevronLeft, Lightbulb, Lock, Minus, Plus, Trash2, X } from "lucide-react";
import type { DesignProblem } from "@/content/problem-types";
import { designScenarios } from "@/content/designs";
import { evaluate, type DesignScenario, type Evaluation } from "@/lib/design/evaluate";
import { catalog, fmtLatency, fmtPct, kindsInPalette, simulate, type Design, type NodeKind } from "@/lib/design/sim";
import { problemsProgress, scheduleSolve, updateProblem } from "@/lib/progress";
import MiniMarkdown from "@/components/ui/MiniMarkdown";
import { useMounted } from "@/lib/use-mounted";

type BoxData = { kind: NodeKind; count: number };
type BoxNode = Node<BoxData, "box">;

const DEFAULT_POS: Record<NodeKind, [number, number]> = {
  client: [0, 200], cdn: [0, 60], lb: [170, 200], app: [340, 200], cache: [540, 70], sql: [540, 230], replica: [720, 120],
  kv: [720, 230], idgen: [340, 380], queue: [540, 390], worker: [720, 390], analytics: [900, 390],
};

const toNodes = (d: Design): BoxNode[] =>
  d.nodes.map((n) => ({ id: n.kind, type: "box", position: { x: n.x, y: n.y }, data: { kind: n.kind, count: n.count }, deletable: n.kind !== "client" }));
const toEdges = (d: Design): Edge[] => d.edges.map(([a, b]) => ({ id: `${a}-${b}`, source: a, target: b }));
const linked = (edges: Edge[], a: string, b: string) => edges.some((e) => (e.source === a && e.target === b) || (e.source === b && e.target === a));

/** Live load per component, read by the canvas boxes. */
const LoadContext = createContext<Partial<Record<NodeKind, number>>>({});

function Box({ data, selected }: NodeProps<BoxNode>) {
  const u = useContext(LoadContext)[data.kind];
  const spec = catalog[data.kind];
  const tone = u === undefined ? "var(--ink-3)" : u >= 1 ? "var(--fail)" : u > 0.7 ? "var(--warn)" : "var(--pass)";
  return (
    <div className={`lab-box${selected ? " selected" : ""}`} data-kind={data.kind}>
      <Handle type="target" position={Position.Left} />
      <div style={{ fontWeight: 600, fontSize: 13 }}>{spec.short}</div>
      <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{data.kind === "client" ? "peak traffic" : `× ${data.count}`}</div>
      {u !== undefined && (
        <div className="lab-meter" aria-label={`${fmtPct(u)} busy`}>
          <span style={{ width: `${Math.min(100, u * 100)}%`, background: tone }} />
        </div>
      )}
      {u !== undefined && <div style={{ fontSize: 12, color: tone, fontVariantNumeric: "tabular-nums" }}>{fmtPct(u)}</div>}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { box: Box };

export default function DesignLab(props: { problem: DesignProblem; from: string }) {
  // The saved design lives in localStorage, so the lab renders only on the client.
  if (!useMounted()) return <div className="bench" />;
  return (
    <ReactFlowProvider>
      <Lab {...props} />
    </ReactFlowProvider>
  );
}

function Lab({ problem: p, from }: { problem: DesignProblem; from: string }) {
  const s = designScenarios[p.scenarioId];
  const state = problemsProgress.use()[p.id];
  const saved = (problemsProgress.get()[p.id]?.design as Design | undefined) ?? s.start;
  const [nodes, setNodes, onNodesChange] = useNodesState<BoxNode>(toNodes(saved));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(toEdges(saved));
  const [decisions, setDecisions] = useState<Record<string, string>>(saved.decisions);
  const [tab, setTab] = useState<"brief" | "design">("brief");
  const [report, setReport] = useState<{ ev: Evaluation; key: string } | null>(null);
  const flow = useReactFlow();
  // Refit after loading a design, and when the canvas becomes visible on phones (it's measured at 0×0 while hidden).
  const [fitTick, setFitTick] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => flow.fitView({ padding: 0.15, maxZoom: 1.2 }), 60);
    return () => clearTimeout(t);
  }, [fitTick, tab, flow]);

  const design: Design = useMemo(
    () => ({
      nodes: nodes.map((n) => ({ kind: n.data.kind, count: n.data.count, x: Math.round(n.position.x), y: Math.round(n.position.y) })),
      edges: edges.map((e) => [e.source as NodeKind, e.target as NodeKind]),
      decisions,
    }),
    [nodes, edges, decisions],
  );
  const key = JSON.stringify([design.nodes.map((n) => [n.kind, n.count]), design.edges, decisions]);
  const live = useMemo(() => simulate(design, s.traffic), [design, s.traffic]);
  const loads = useMemo(() => Object.fromEntries(Object.entries(live.load).map(([k, v]) => [k, v!.utilization])), [live]);

  // Save shortly after each change, and straight away if the page is closed or left first.
  const snapshot = JSON.stringify(design);
  const pending = useRef<string | null>(null);
  const flush = useCallback(() => {
    if (pending.current === null) return;
    const d = JSON.parse(pending.current) as Design;
    pending.current = null;
    updateProblem(p.id, (st) => ({ ...st, design: d }));
  }, [p.id]);
  useEffect(() => {
    pending.current = snapshot;
    const t = setTimeout(flush, 300);
    return () => clearTimeout(t);
  }, [snapshot, flush]);
  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  const selected = nodes.find((n) => n.selected);
  const selectedEdge = edges.find((e) => e.selected);

  const onConnect = useCallback(
    (c: Connection) => setEdges((es) => (c.source === c.target || linked(es, c.source, c.target) ? es : addEdge({ ...c, id: `${c.source}-${c.target}` }, es))),
    [setEdges],
  );

  function addKind(kind: NodeKind) {
    if (nodes.some((n) => n.id === kind)) return;
    let [x, y] = DEFAULT_POS[kind];
    while (nodes.some((n) => Math.abs(n.position.x - x) < 60 && Math.abs(n.position.y - y) < 40)) [x, y] = [x + 30, y + 30];
    const spec = catalog[kind];
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), { id: kind, type: "box", position: { x, y }, data: { kind, count: spec.fixedCount ?? 1 }, selected: true }]);
    setTab("design");
  }

  function setCount(kind: NodeKind, count: number) {
    const spec = catalog[kind];
    const c = Math.max(1, Math.min(spec.maxCount, count));
    setNodes((ns) => ns.map((n) => (n.id === kind ? { ...n, data: { ...n.data, count: c } } : n)));
  }

  function removeNode(kind: NodeKind) {
    setNodes((ns) => ns.filter((n) => n.id !== kind));
    setEdges((es) => es.filter((e) => e.source !== kind && e.target !== kind));
  }

  function link(a: string, b: string) {
    onConnect({ source: a, target: b, sourceHandle: null, targetHandle: null });
  }

  function load(d: Design) {
    setNodes(toNodes(d));
    setEdges(toEdges(d));
    setDecisions(d.decisions);
    setReport(null);
    setFitTick((t) => t + 1);
  }

  function runSimulation() {
    const ev = evaluate(s, design);
    setReport({ ev, key });
    updateProblem(p.id, (st) => ({ ...st, attempts: st.attempts + 1 }));
    if (ev.checks.every((c) => c.pass)) scheduleSolve(p.id);
  }

  const solved = state?.status === "solved";
  const stale = report && report.key !== key;
  const passCount = report?.ev.checks.filter((c) => c.pass).length ?? 0;

  return (
    <div className="bench">
      <header className="bench-head">
        <Link href={from} className="icon-btn" aria-label="Back"><ChevronLeft size={20} /></Link>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "var(--ink-3)", flexWrap: "wrap" }}>
            <span className={`chip ${p.level.toLowerCase()}`}>{p.level}</span>
            <span>{p.shape}</span>
            {solved && <span className="chip easy"><Check size={11} /> Solved</span>}
          </div>
        </div>
        <button className="btn small primary" onClick={() => { runSimulation(); setTab("design"); }}><Activity size={14} /> Simulate</button>
      </header>

      <div className="bench-tabs seg" role="group" aria-label="Show" style={{ margin: "8px 14px 0" }}>
        <button aria-pressed={tab === "brief"} onClick={() => setTab("brief")}>Brief</button>
        <button aria-pressed={tab === "design"} onClick={() => setTab("design")}>Design</button>
      </div>

      <div className="bench-body lab" data-tab={tab === "brief" ? "problem" : "code"}>
        <section className="bench-pane bench-left" aria-label="Brief">
          <div className="statement"><MiniMarkdown text={s.statement} /></div>

          <p className="kicker" style={{ margin: "18px 0 6px" }}>Must do</p>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.65, fontSize: 14.5 }}>{s.functional.map((r) => <li key={r}>{r}</li>)}</ul>
          <p className="kicker" style={{ margin: "16px 0 6px" }}>Must be</p>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.65, fontSize: 14.5 }}>{s.nonFunctional.map((r) => <li key={r}>{r}</li>)}</ul>

          <p className="kicker" style={{ margin: "20px 0 6px" }}>The numbers</p>
          <div className="card" style={{ overflow: "hidden" }}>
            {s.estimates.map((e, i) => (
              <div key={e.label} style={{ padding: "8px 12px", borderTop: i ? "1px solid var(--rule)" : undefined, fontSize: 13.5 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ fontWeight: 600 }}>{e.label}</strong>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{e.value}</span>
                </div>
                <div style={{ color: "var(--ink-2)", marginTop: 2 }}>{e.how}</div>
              </div>
            ))}
          </div>

          <p className="kicker" style={{ margin: "22px 0 6px" }}>Decisions</p>
          <div style={{ display: "grid", gap: 12 }}>
            {s.decisions.map((d) => {
              const chosen = d.options.find((o) => o.value === decisions[d.id]);
              return (
                <fieldset key={d.id} className="card" style={{ padding: "12px 14px", margin: 0 }}>
                  <legend style={{ fontWeight: 600, fontSize: 14, padding: "0 4px" }}>{d.question}</legend>
                  {d.options.map((o) => (
                    <label key={o.value} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "4px 0", fontSize: 14, lineHeight: 1.45, cursor: "pointer" }}>
                      <input type="radio" name={d.id} value={o.value} checked={decisions[d.id] === o.value} onChange={() => setDecisions((ds) => ({ ...ds, [d.id]: o.value }))} style={{ marginTop: 3 }} />
                      {o.label}
                    </label>
                  ))}
                  {chosen && <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--ink-2)", fontFamily: "var(--serif)", lineHeight: 1.55 }}>{chosen.consequence}</p>}
                </fieldset>
              );
            })}
          </div>

          <Guidance s={s} p={p} unlocked={(state?.attempts ?? 0) > 0} onLoad={() => load(s.reference)} />
        </section>

        <section className="bench-pane lab-right" aria-label="Your design">
          <div className="lab-palette" role="toolbar" aria-label="Add a component">
            {kindsInPalette.map((k) => (
              <button key={k} className="btn small" disabled={nodes.some((n) => n.id === k)} onClick={() => addKind(k)} title={catalog[k].note}>
                <Plus size={13} /> {catalog[k].label}
              </button>
            ))}
            <button className="btn small" onClick={() => load(s.start)} title="Start again from an empty canvas">Clear</button>
          </div>

          <div className="lab-canvas">
            <LoadContext.Provider value={loads}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                connectionMode={ConnectionMode.Loose}
                fitView
                fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
                minZoom={0.3}
                proOptions={{ hideAttribution: true }}
                aria-label="Design canvas: drag from a dot on one box to another to link them"
              >
                <Background gap={18} size={1} color="var(--rule-2)" />
                <Controls showInteractive={false} />
              </ReactFlow>
            </LoadContext.Provider>
          </div>

          <div className="lab-bottom">
            {selected ? (
              <Inspector
                kind={selected.data.kind}
                count={selected.data.count}
                load={loads[selected.data.kind]}
                others={nodes.filter((n) => n.id !== selected.id).map((n) => n.data.kind)}
                links={edges.filter((e) => e.source === selected.id || e.target === selected.id).map((e) => (e.source === selected.id ? e.target : e.source) as NodeKind)}
                onCount={(c) => setCount(selected.data.kind, c)}
                onLink={(k) => link(selected.id, k)}
                onUnlink={(k) => setEdges((es) => es.filter((e) => !((e.source === selected.id && e.target === k) || (e.source === k && e.target === selected.id))))}
                onRemove={() => removeNode(selected.data.kind)}
              />
            ) : selectedEdge ? (
              <div className="lab-inspector">
                <span>Link: {catalog[selectedEdge.source as NodeKind].label} ↔ {catalog[selectedEdge.target as NodeKind].label}</span>
                <button className="btn small" onClick={() => setEdges((es) => es.filter((e) => e.id !== selectedEdge.id))}><Trash2 size={13} /> Remove link</button>
              </div>
            ) : (
              <div className="lab-inspector" style={{ color: "var(--ink-3)" }}>
                Select a box to set its machine count or link it. Drag from a dot on one box to another to link them.
              </div>
            )}

            <div className="lab-metrics" aria-label="Live estimate at peak">
              <Metric label="Redirect" value={live.read.ok ? fmtLatency(live.read.latencyMs) : "—"} bad={!live.read.ok} />
              <Metric label="New link" value={live.write.ok ? fmtLatency(live.write.latencyMs) : "—"} bad={!live.write.ok} />
              <Metric label="Busiest" value={live.bottleneck ? `${catalog[live.bottleneck.kind].short} ${fmtPct(live.bottleneck.utilization)}` : "—"} bad={(live.bottleneck?.utilization ?? 0) >= 1} />
              <Metric label="Cost" value={`$${live.costPerMonth.toLocaleString("en-US")}/mo`} />
            </div>

            <div className="results" style={{ paddingTop: 4 }}>
              {!report ? (
                <p style={{ color: "var(--ink-3)", margin: "6px 0" }}>
                  Simulate runs your design at peak ({s.traffic.readsPerSec.toLocaleString("en-US")} redirects and {s.traffic.writesPerSec} new links a second), checks every requirement, then knocks out one machine at a time.
                </p>
              ) : (
                <>
                  <p role="status" className="lab-verdict" style={{ fontWeight: 600, margin: "4px 0 8px", color: passCount === report.ev.checks.length ? "var(--pass)" : "var(--fail)" }}>
                    {passCount === report.ev.checks.length ? `All ${passCount} checks pass. Solid design.` : `${passCount} of ${report.ev.checks.length} checks pass`}
                    {stale && <span style={{ color: "var(--warn)", fontWeight: 400 }}> · design changed since, simulate again</span>}
                  </p>
                  {report.ev.checks.map((c) => (
                    <div key={c.id} className="result-row" data-check={c.id} data-pass={c.pass}>
                      <span aria-hidden="true">{c.pass ? <Check size={15} color="var(--pass)" /> : <X size={15} color="var(--fail)" />}</span>
                      <span>{c.label}</span>
                      <span />
                      <div className="detail">{c.detail}</div>
                    </div>
                  ))}
                  {report.ev.failures.length > 0 && (
                    <>
                      <p className="kicker" style={{ margin: "14px 0 4px" }}>Failure drill</p>
                      {report.ev.failures.map((f) => {
                        const fine = f.sim.read.ok && f.sim.write.ok;
                        return (
                          <div key={f.kind} className="result-row">
                            <span aria-hidden="true">{fine ? <Check size={15} color="var(--pass)" /> : <X size={15} color="var(--fail)" />}</span>
                            <span>{f.note}</span>
                            <span />
                            {!fine && <div className="detail">{(!f.sim.read.ok ? f.sim.read.reason : f.sim.write.reason) ?? ""}</div>}
                          </div>
                        );
                      })}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div>
      <div className="kicker" style={{ margin: 0 }}>{label}</div>
      <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500, color: bad ? "var(--fail)" : "var(--ink)" }}>{value}</div>
    </div>
  );
}

function Inspector(props: {
  kind: NodeKind;
  count: number;
  load?: number;
  others: NodeKind[];
  links: NodeKind[];
  onCount: (c: number) => void;
  onLink: (k: NodeKind) => void;
  onUnlink: (k: NodeKind) => void;
  onRemove: () => void;
}) {
  const spec = catalog[props.kind];
  const fixed = spec.fixedCount !== undefined;
  const unlinked = props.others.filter((k) => !props.links.includes(k));
  return (
    <div className="lab-inspector" aria-label={`${spec.label} settings`}>
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <strong style={{ fontWeight: 600 }}>{spec.label}</strong>
        <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{spec.note}</div>
        {props.kind !== "client" && <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>${spec.costPerMonth} a month per machine{props.load !== undefined ? ` · ${fmtPct(props.load)} busy` : ""}</div>}
      </div>
      {!fixed && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }} role="group" aria-label="Machines">
          <button className="icon-btn" aria-label="Fewer machines" onClick={() => props.onCount(props.count - 1)} disabled={props.count <= 1}><Minus size={14} /></button>
          <span style={{ minWidth: 26, textAlign: "center", fontVariantNumeric: "tabular-nums" }} aria-live="polite" data-testid="count">{props.count}</span>
          <button className="icon-btn" aria-label="More machines" onClick={() => props.onCount(props.count + 1)} disabled={props.count >= spec.maxCount}><Plus size={14} /></button>
        </div>
      )}
      {unlinked.length > 0 && (
        <select aria-label="Link to" value="" onChange={(e) => e.target.value && props.onLink(e.target.value as NodeKind)} className="lab-select">
          <option value="">Link to…</option>
          {unlinked.map((k) => <option key={k} value={k}>{catalog[k].label}</option>)}
        </select>
      )}
      {props.links.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flexBasis: "100%" }}>
          {props.links.map((k) => (
            <button key={k} className="chip" onClick={() => props.onUnlink(k)} aria-label={`Remove link to ${catalog[k].label}`} style={{ cursor: "pointer", border: 0 }}>
              ↔ {catalog[k].short} <X size={11} />
            </button>
          ))}
        </div>
      )}
      {props.kind !== "client" && <button className="icon-btn" aria-label={`Remove ${spec.label}`} title="Remove" onClick={props.onRemove}><Trash2 size={15} /></button>}
    </div>
  );
}

function Guidance({ s, p, unlocked, onLoad }: { s: DesignScenario; p: DesignProblem; unlocked: boolean; onLoad: () => void }) {
  const state = problemsProgress.use()[p.id];
  const used = state?.hintsUsed ?? 0;
  const [open, setOpen] = useState(false);
  const labels = ["Nudge", "Approach", "Plan"];
  const canOpen = unlocked || used >= s.hints.length;
  return (
    <div style={{ marginTop: 26, display: "grid", gap: 14 }}>
      <div className="card" style={{ padding: "14px 16px" }}>
        <p className="kicker" style={{ margin: "0 0 8px", display: "flex", gap: 6, alignItems: "center" }}><Lightbulb size={13} /> Hints · {used} of {s.hints.length}</p>
        {s.hints.slice(0, used).map((h, i) => (
          <p key={i} style={{ margin: "0 0 10px", fontFamily: "var(--serif)", fontSize: 15.5, lineHeight: 1.6 }}>
            <span className="kicker" style={{ display: "block", marginBottom: 2 }}>{labels[i]}</span>
            {h}
          </p>
        ))}
        {used < s.hints.length && (
          <button className="btn small" onClick={() => updateProblem(p.id, (st) => ({ ...st, hintsUsed: Math.max(st.hintsUsed, used + 1) }))}>Show {labels[used].toLowerCase()}</button>
        )}
      </div>

      {!canOpen ? (
        <div className="card" style={{ padding: "14px 16px", color: "var(--ink-3)", display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}>
          <Lock size={14} /> The reference design opens after you simulate once or use all the hints.
        </div>
      ) : !open ? (
        <button className="btn" onClick={() => { setOpen(true); updateProblem(p.id, (st) => ({ ...st, walkthroughSeen: true })); }}>Open the reference design</button>
      ) : (
        <div className="card" style={{ padding: "16px 18px" }}>
          <p className="kicker" style={{ margin: "0 0 8px" }}>Reference design</p>
          <p style={{ fontFamily: "var(--serif)", fontSize: 15.5, lineHeight: 1.65, margin: "0 0 12px" }}>{s.walkthrough.summary}</p>
          <ol style={{ margin: "0 0 12px", paddingLeft: 20, fontSize: 14, lineHeight: 1.6 }}>{s.walkthrough.steps.map((x) => <li key={x} style={{ marginBottom: 4 }}>{x}</li>)}</ol>
          <button className="btn small" onClick={onLoad}>Load it onto the canvas</button>
          <p className="kicker" style={{ margin: "14px 0 4px" }}>Trade-offs to mention</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>{s.walkthrough.tradeoffs.map((x) => <li key={x}>{x}</li>)}</ul>
          <p className="kicker" style={{ margin: "14px 0 4px" }}>Follow-ups interviewers ask</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>{s.walkthrough.followUps.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
