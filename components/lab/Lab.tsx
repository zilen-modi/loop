"use client";

import "@xyflow/react/dist/style.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge, Background, ConnectionMode, Controls as ZoomControls, MiniMap, ReactFlow, ReactFlowProvider,
  useEdgesState, useNodesState, useReactFlow, useViewport, ViewportPortal, type Connection, type Edge,
} from "@xyflow/react";
import { Activity, Check, ChevronLeft, Eraser, LayoutGrid, PanelLeftClose, PanelLeftOpen, ShieldAlert } from "lucide-react";
import type { DesignProblem } from "@/content/problem-types";
import { designScenarios } from "@/content/designs";
import { catalog, type NodeKind } from "@/lib/design/catalog";
import { simulate } from "@/lib/design/engine";
import { evaluate, type Evaluation } from "@/lib/design/evaluate";
import type { Design } from "@/lib/design/graph";
import { problemsProgress, scheduleSolve, updateProblem } from "@/lib/progress";
import { useMounted, usePrefersReducedMotion } from "@/lib/use-mounted";
import NodeCard, { type BoxNode } from "./NodeCard";
import FlowEdge from "./FlowEdge";
import Palette, { DRAG_TYPE } from "./Palette";
import Inspector from "./Inspector";
import Brief from "./Brief";
import Interview from "./Interview";
import { CostBar, HopBar, Scorecard, Tiles } from "./Dashboard";
import { Drill, TraceButton, TrafficSlider, type DrillStep } from "./Controls";
import { categoryLabel, LabContext, laneOrder, type LabLive } from "./visuals";

const nodeTypes = { box: NodeCard };
const edgeTypes = { flow: FlowEdge };

// Lanes: one column per category, left to right in the order requests usually travel.
const LANE_W = 186;
const LANE_X0 = -24;
const ROW_H = 92;
const laneIndex = (k: NodeKind) => laneOrder.indexOf(catalog[k].category);
const laneX = (k: NodeKind) => LANE_X0 + laneIndex(k) * LANE_W + 14;

const toNodes = (d: Design): BoxNode[] =>
  d.nodes.map((n) => ({ id: n.kind, type: "box", position: { x: n.x, y: n.y }, data: { kind: n.kind, count: n.count }, deletable: n.kind !== "client" }));
const toEdges = (d: Design): Edge[] => d.edges.map(([a, b]) => ({ id: `${a}-${b}`, source: a, target: b, type: "flow" }));
const linked = (edges: Edge[], a: string, b: string) => edges.some((e) => (e.source === a && e.target === b) || (e.source === b && e.target === a));

/** Lays every box out in its category's lane, in catalog order. */
export function tidy(d: Design): Design {
  const order = Object.keys(catalog) as NodeKind[];
  const rows: Record<number, number> = {};
  const nodes = [...d.nodes]
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
    .map((n) => {
      const lane = laneIndex(n.kind);
      const row = (rows[lane] = (rows[lane] ?? -1) + 1);
      return { ...n, x: laneX(n.kind), y: 40 + row * ROW_H };
    });
  return { ...d, nodes };
}

const scaleTraffic = (t: Record<string, number>, f: number) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, /PerSec$/.test(k) ? v * f : v]));

export default function DesignLab(props: { problem: DesignProblem; from: string }) {
  // The saved design lives in localStorage, so the lab renders only on the client.
  if (!useMounted()) return <div className="bench" />;
  return (
    <ReactFlowProvider>
      <Lab {...props} />
    </ReactFlowProvider>
  );
}

function Lanes({ nodes }: { nodes: BoxNode[] }) {
  // Lanes up to the right-most one in use; empty ones at the far end would only shrink the view.
  const last = Math.max(2, ...nodes.map((n) => laneIndex(n.data.kind)));
  const ys = nodes.map((n) => n.position.y);
  const top = Math.min(0, ...ys) - 50;
  const bottom = Math.max(420, ...ys.map((y) => y + 140));
  return (
    <ViewportPortal>
      {laneOrder.slice(0, last + 1).map((c, i) => (
        <div key={c} className="lab-lane" style={{ transform: `translate(${LANE_X0 + i * LANE_W}px, ${top}px)`, width: LANE_W, height: bottom - top }} aria-hidden="true">
          <span>{categoryLabel[c]}</span>
        </div>
      ))}
    </ViewportPortal>
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
  const [wide, setWide] = useState(false);
  const [report, setReport] = useState<{ ev: Evaluation; key: string } | null>(null);
  const [scale, setScale] = useState(1);
  const [highlight, setHighlight] = useState<NodeKind[] | null>(null);
  const [drill, setDrill] = useState<{ steps: DrillStep[]; index: number; playing: boolean } | null>(null);
  const [trace, setTrace] = useState<{ i: number } | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const flow = useReactFlow();
  const viewport = useViewport();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ w: 0, h: 0 });
  const [fitTick, setFitTick] = useState(0);

  const design: Design = useMemo(
    () => ({
      nodes: nodes.map((n) => ({ kind: n.data.kind, count: n.data.count, x: Math.round(n.position.x), y: Math.round(n.position.y) })),
      edges: edges.map((e) => [e.source as NodeKind, e.target as NodeKind]),
      decisions,
    }),
    [nodes, edges, decisions],
  );
  const key = JSON.stringify([design.nodes.map((n) => [n.kind, n.count]), design.edges, decisions]);
  const traffic = useMemo(() => scaleTraffic(s.traffic, scale), [s.traffic, scale]);
  const live = useMemo(() => simulate(s, design, {}), [s, design]); // peak, for the dashboard
  const shown = useMemo(() => (drill ? drill.steps[drill.index].sim : scale === 1 ? live : simulate({ ...s, traffic }, design)), [drill, scale, live, s, traffic, design]);
  const primary = s.metrics.map((m) => m.flow);

  // ——— save shortly after each change, and straight away if the page is left
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

  // ——— canvas size (for keeping the inspector on screen) and fitting the view
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    let was = el.clientWidth;
    const ro = new ResizeObserver(() => {
      setBounds({ w: el.clientWidth, h: el.clientHeight });
      if (was === 0 && el.clientWidth > 0) setFitTick((t) => t + 1); // shown again (phones switch tabs)
      was = el.clientWidth;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    // On a narrow canvas, keep boxes readable and let people pan rather than shrinking everything.
    const narrow = (canvasRef.current?.clientWidth ?? 1000) < 600;
    const t = setTimeout(() => flow.fitView({ padding: 0.08, maxZoom: 1.1, minZoom: narrow ? 0.6 : undefined }), 60);
    return () => clearTimeout(t);
  }, [fitTick, flow]);
  // Phones show one pane at a time: each tab starts at the top.
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  // ——— editing
  const onConnect = useCallback(
    (c: Connection) => setEdges((es) => (c.source === c.target || linked(es, c.source, c.target) ? es : addEdge({ ...c, id: `${c.source}-${c.target}`, type: "flow" }, es))),
    [setEdges],
  );
  const free = (kind: NodeKind, x: number, y: number) => {
    while (nodes.some((n) => Math.abs(n.position.x - x) < 120 && Math.abs(n.position.y - y) < 70)) y += ROW_H;
    return { x, y };
  };
  function addKind(kind: NodeKind, at?: { x: number; y: number }) {
    if (nodes.some((n) => n.id === kind)) return;
    const pos = at ?? free(kind, laneX(kind), 40);
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), { id: kind, type: "box", position: pos, data: { kind, count: catalog[kind].fixedCount ?? 1 }, selected: true }]);
    setTab("design");
  }
  const setCount = (kind: NodeKind, count: number) => {
    const c = Math.max(1, Math.min(catalog[kind].maxCount, count));
    setNodes((ns) => ns.map((n) => (n.id === kind ? { ...n, data: { ...n.data, count: c } } : n)));
  };
  const removeNode = (kind: NodeKind) => {
    setNodes((ns) => ns.filter((n) => n.id !== kind));
    setEdges((es) => es.filter((e) => e.source !== kind && e.target !== kind));
  };
  const unlink = (a: string, b: string) => setEdges((es) => es.filter((e) => !((e.source === a && e.target === b) || (e.source === b && e.target === a))));
  function load(d: Design) {
    setNodes(toNodes(d));
    setEdges(toEdges(d));
    setDecisions(d.decisions);
    setReport(null);
    setDrill(null);
    setFitTick((t) => t + 1);
  }
  const onDrop = (e: React.DragEvent) => {
    const kind = e.dataTransfer.getData(DRAG_TYPE) as NodeKind;
    if (!kind || !catalog[kind]) return;
    e.preventDefault();
    const pt = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    addKind(kind, { x: Math.round((pt.x - 80) / 20) * 20, y: Math.round((pt.y - 30) / 20) * 20 });
  };

  // ——— simulate, drill and trace
  function runSimulation() {
    const ev = evaluate(s, design);
    setReport({ ev, key });
    setTab("design");
    updateProblem(p.id, (st) => ({ ...st, attempts: st.attempts + 1 }));
    if (ev.checks.every((c) => c.pass)) scheduleSolve(p.id);
    return ev;
  }
  function startDrill() {
    const ev = report && report.key === key ? report.ev : runSimulation();
    if (!ev.failures.length) return;
    setScale(1);
    setDrill({ steps: ev.failures, index: 0, playing: false });
  }
  useEffect(() => {
    if (!drill?.playing) return;
    if (drill.index >= drill.steps.length - 1) return setDrill((d) => d && { ...d, playing: false });
    const t = setTimeout(() => setDrill((d) => d && { ...d, index: d.index + 1 }), reducedMotion ? 700 : 1400);
    return () => clearTimeout(t);
  }, [drill, reducedMotion]);
  useEffect(() => {
    if (drill) setDrill(null); // the design changed under the drill
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const slow = shown.flows[s.metrics[0].flow];
  useEffect(() => {
    if (!trace || !slow?.ok) return;
    const t = setTimeout(() => setTrace((tr) => (tr && tr.i < slow.hops.length ? { i: tr.i + 1 } : null)), trace.i < slow.hops.length ? (reducedMotion ? 350 : 750) : 1800);
    return () => clearTimeout(t);
  }, [trace, slow, reducedMotion]);

  const traceState = useMemo(() => {
    if (!trace || !slow?.ok || !slow.hops.length) return undefined;
    const i = Math.min(trace.i, slow.hops.length - 1);
    const sofar = slow.hops.slice(0, i + 1).reduce((t, h) => t + h.ms, 0);
    return { kind: slow.hops[i].kind, ms: slow.hops[i].ms, total: trace.i >= slow.hops.length ? sofar : undefined };
  }, [trace, slow]);

  // ——— what the canvas pieces read
  const util = useMemo(() => Object.fromEntries(Object.entries(shown.load).map(([k, v]) => [k, v!.utilization])), [shown]);
  const throughput = useMemo(() => Object.fromEntries(Object.entries(shown.load).map(([k, v]) => [k, v!.load])), [shown]);
  const liveCtx: LabLive = {
    util,
    throughput,
    rates: shown.edgeRates,
    failed: drill ? drill.steps[drill.index].kind : undefined,
    highlight: traceState ? new Set<NodeKind>(["client", ...(slow?.path ?? [])]) : highlight ? new Set<NodeKind>(["client", ...highlight]) : undefined,
    trace: traceState,
    reducedMotion,
  };

  const selected = nodes.find((n) => n.selected);
  const anchor = useMemo(() => {
    if (!selected) return null;
    const internal = flow.getInternalNode(selected.id);
    if (!internal) return null;
    const { x, y } = internal.internals.positionAbsolute;
    const w = (internal.measured.width ?? 160) * viewport.zoom;
    const h = (internal.measured.height ?? 60) * viewport.zoom;
    return { x: x * viewport.zoom + viewport.x, y: y * viewport.zoom + viewport.y, w, h };
  }, [selected, flow, viewport]);
  // Escape closes the inspector from anywhere except a text field.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || (e.target as HTMLElement).closest("input[type=text], input:not([type]), textarea, select, .lab-inspector")) return;
      closeInspector();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const closeInspector = () => {
    const id = selected?.id;
    setNodes((ns) => ns.map((n) => ({ ...n, selected: false })));
    if (id) requestAnimationFrame(() => document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)?.focus());
  };

  const checks = report
    ? report.ev.checks.map((c) => {
        const crit = s.criteria.find((x) => x.id === c.id)!;
        return { ...c, short: crit.short ?? c.label, focus: crit.focus ? crit.focus(report.ev) : design.nodes.map((n) => n.kind) };
      })
    : null;
  const solved = state?.status === "solved";
  const onCanvas = new Set(nodes.map((n) => n.id as NodeKind));

  return (
    <div className="bench lab-v2">
      <header className="bench-head">
        <Link href={from} className="icon-btn" aria-label="Back"><ChevronLeft size={20} /></Link>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "var(--ink-3)", flexWrap: "wrap" }}>
            <span className={`chip ${p.level.toLowerCase()}`}>{p.level}</span>
            <span className="lab-shape">{p.shape}</span>
            {solved && <span className="chip easy"><Check size={11} /> Solved</span>}
          </div>
        </div>
        <button className="btn small lab-brief-toggle" onClick={() => { setWide(!wide); setFitTick((t) => t + 1); }} aria-pressed={wide}>
          {wide ? <PanelLeftOpen size={14} aria-hidden="true" /> : <PanelLeftClose size={14} aria-hidden="true" />} {wide ? "Show brief" : "Hide brief"}
        </button>
        <button className="btn small primary" onClick={runSimulation}><Activity size={14} /> Simulate</button>
      </header>

      <div className="bench-tabs seg" role="group" aria-label="Show" style={{ margin: "8px 14px 0" }}>
        <button aria-pressed={tab === "brief"} onClick={() => setTab("brief")}>Brief</button>
        <button aria-pressed={tab === "design"} onClick={() => setTab("design")}>Design</button>
      </div>

      <div ref={bodyRef} className={`bench-body lab${wide ? " wide" : ""}`} data-tab={tab === "brief" ? "problem" : "code"}>
        <section className="bench-pane bench-left" aria-label="Brief">
          <Brief s={s} p={p} decisions={decisions} onDecide={(id, v) => setDecisions((d) => ({ ...d, [id]: v }))} onLoadReference={() => load(tidy(s.reference))}>
            <Interview id={p.id} />
          </Brief>
        </section>

        <section className="lab-main" aria-label="Your design">
          <div className="lab-toolbar" role="toolbar" aria-label="Simulation">
            <TrafficSlider scale={drill ? 1 : scale} onScale={setScale} label={s.trafficLabel(drill ? 1 : scale)} />
            <TraceButton running={!!trace} disabled={!slow?.ok} onTrace={() => setTrace(trace ? null : { i: 0 })} />
            <button className="btn small" onClick={() => (drill ? setDrill(null) : startDrill())} aria-pressed={!!drill}><ShieldAlert size={14} aria-hidden="true" /> Failure drill</button>
            <span className="lab-spacer" />
            <button className="btn small" onClick={() => { load(tidy(design)); }} title="Lay boxes out by lane" aria-label="Tidy up"><LayoutGrid size={14} aria-hidden="true" /><span className="lbl"> Tidy up</span></button>
            <button className="btn small" onClick={() => load(s.start)} title="Start again from an empty canvas" aria-label="Clear"><Eraser size={14} aria-hidden="true" /><span className="lbl"> Clear</span></button>
          </div>

          <div className="lab-work">
            <Palette onCanvas={onCanvas} onAdd={(k) => addKind(k)} />
            <div className="lab-canvas" ref={canvasRef} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }} onDrop={onDrop}>
              <LabContext.Provider value={liveCtx}>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  edgeTypes={edgeTypes}
                  defaultEdgeOptions={{ type: "flow" }}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  connectionMode={ConnectionMode.Loose}
                  snapToGrid
                  snapGrid={[20, 20]}
                  fitView
                  fitViewOptions={{ padding: 0.08, maxZoom: 1.1 }}
                  minZoom={0.25}
                  proOptions={{ hideAttribution: true }}
                  aria-label="Design canvas. Drag from a dot on one box to another to link them, or use a box's settings."
                >
                  <Lanes nodes={nodes} />
                  <Background gap={20} size={1} color="var(--rule-2)" />
                  <MiniMap pannable zoomable style={{ width: 150, height: 96 }} nodeClassName={(n) => `cat-${catalog[(n.data as { kind: NodeKind }).kind].category}`} className="lab-minimap" ariaLabel="Mini map" />
                  <ZoomControls showInteractive={false} className="lab-zoom" />
                </ReactFlow>
                {selected && (
                  <Inspector
                    kind={selected.data.kind}
                    count={selected.data.count}
                    util={util[selected.data.kind]}
                    throughput={throughput[selected.data.kind]}
                    anchor={anchor}
                    bounds={bounds}
                    others={nodes.filter((n) => n.id !== selected.id).map((n) => n.data.kind)}
                    links={edges.filter((e) => e.source === selected.id || e.target === selected.id).map((e) => (e.source === selected.id ? e.target : e.source) as NodeKind)}
                    onCount={(c) => setCount(selected.data.kind, c)}
                    onLink={(k) => onConnect({ source: selected.id, target: k, sourceHandle: null, targetHandle: null })}
                    onUnlink={(k) => unlink(selected.id, k)}
                    onRemove={() => removeNode(selected.data.kind)}
                    onClose={closeInspector}
                  />
                )}
                {traceState?.total !== undefined && <div className="lab-trace-total" role="status">One request: {traceState.total.toFixed(1)} ms</div>}
              </LabContext.Provider>
            </div>
          </div>

          {drill && (
            <Drill
              steps={drill.steps}
              index={drill.index}
              playing={drill.playing}
              primary={primary}
              onIndex={(i) => setDrill((d) => d && { ...d, index: i, playing: false })}
              onPlay={() => setDrill((d) => d && { ...d, playing: !d.playing, index: d.playing || d.index < d.steps.length - 1 ? d.index : 0 })}
              onExit={() => setDrill(null)}
            />
          )}

          <div className="lab-bottom">
            <Tiles s={s} sim={live} />
            {checks ? (
              <Scorecard checks={checks} stale={report!.key !== key} onFocus={setHighlight} />
            ) : (
              <p className="lab-intro">
                Simulate runs your design at peak ({s.trafficLabel(1)}), checks every requirement, then knocks out one machine at a time. The rings and moving dots update as you build.
              </p>
            )}
            <div className="lab-breakdowns">
              <HopBar s={s} sim={live} />
              <CostBar design={design} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
