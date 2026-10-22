// A small, deterministic capacity model for system-design labs. Scenarios declare their request
// flows; this engine routes them through a design and estimates load, utilisation, latency and cost.

import { catalog, type NodeKind } from "./catalog";
import { makeGraph, rateKey, type Design, type Graph } from "./graph";

/**
 * One step of a request. `share` is the fraction of the flow's rate that reaches it (a cache hit
 * stops requests before the database). Hops with `onPath: false` add load but not latency
 * (replication, cache invalidation). `from` names where the traffic comes from, for link rates.
 */
export type Hop = { kind: NodeKind; share?: number; write?: boolean; onPath?: boolean; from?: NodeKind };

export type Route = { rate: number; hops: Hop[] };
export type Broken = { broken: string; rate?: number; hops?: Hop[] };

export type Traffic = Record<string, number>;

export type FlowDef = {
  id: string;
  label: string;
  /** Routes the flow through a design; any partial hops of a broken route still add load. */
  route: (g: Graph, t: Traffic) => Route | Broken;
};

export type FlowResult = {
  ok: boolean;
  reason?: string;
  rate: number;
  latencyMs: number;
  /** The hops a request waits on, in order, with the time each one takes at this load. */
  hops: { kind: NodeKind; ms: number }[];
  path: NodeKind[];
};

export type SimResult = {
  flows: Record<string, FlowResult>;
  load: Partial<Record<NodeKind, { load: number; utilization: number }>>;
  /** Requests per second along each link, in the direction of travel, keyed by `rateKey(from, to)`. */
  edgeRates: Record<string, number>;
  bottleneck?: { kind: NodeKind; utilization: number };
  costPerMonth: number;
};

export type Simulatable = { flows: FlowDef[]; traffic: Traffic };

const isBroken = (r: Route | Broken): r is Broken => "broken" in r;

export function simulate(s: Simulatable, design: Design, override: Partial<Record<NodeKind, number>> = {}): SimResult {
  const g = makeGraph(design, override);
  const reads: Partial<Record<NodeKind, number>> = {};
  const writes: Partial<Record<NodeKind, number>> = {};
  const edgeRates: Record<string, number> = {};
  const add = (m: Partial<Record<NodeKind, number>>, k: NodeKind, v: number) => (m[k] = (m[k] ?? 0) + v);

  const routed = s.flows.map((f) => ({ f, r: f.route(g, s.traffic) }));
  for (const { r } of routed) {
    const rate = r.rate ?? 0;
    let prev: NodeKind = "client";
    for (const h of r.hops ?? []) {
      const v = rate * (h.share ?? 1);
      add(h.write ? writes : reads, h.kind, v);
      const from = h.from ?? prev;
      if (v > 0 && g.edge(from, h.kind)) edgeRates[rateKey(from, h.kind)] = (edgeRates[rateKey(from, h.kind)] ?? 0) + v;
      if (h.onPath !== false) prev = h.kind;
    }
  }

  const load: SimResult["load"] = {};
  for (const n of design.nodes) {
    const k = n.kind;
    if (k === "client" || !g.has(k)) continue;
    const spec = catalog[k];
    const rd = reads[k] ?? 0;
    const wr = writes[k] ?? 0;
    const utilization = (rd / spec.capacity + (wr * (spec.writeCost ?? 1)) / (spec.writeCapacity ?? spec.capacity)) / g.count(k);
    load[k] = { load: rd + wr, utilization };
  }

  const ms = (h: Hop) => {
    const spec = catalog[h.kind];
    const base = h.write ? (spec.writeLatencyMs ?? spec.latencyMs) : spec.latencyMs;
    const u = load[h.kind]?.utilization ?? 0;
    return base / Math.max(0.05, 1 - Math.min(u, 0.99)); // queueing: slower as a machine fills up
  };

  const flows: SimResult["flows"] = {};
  for (const { f, r } of routed) {
    const fail = (reason: string): FlowResult => ({ ok: false, reason, rate: r.rate ?? 0, latencyMs: Infinity, hops: [], path: [] });
    if (isBroken(r)) {
      flows[f.id] = fail(r.broken);
      continue;
    }
    const onPath = r.hops.filter((h) => h.onPath !== false);
    const short = onPath.find((h) => catalog[h.kind].minCount && g.count(h.kind) < catalog[h.kind].minCount!.count && !g.overridden(h.kind));
    if (short) {
      flows[f.id] = fail(catalog[short.kind].minCount!.reason);
      continue;
    }
    const over = onPath.find((h) => (load[h.kind]?.utilization ?? 0) >= 1);
    if (over) {
      flows[f.id] = fail(`Overloaded: ${catalog[over.kind].label} at ${Math.round(load[over.kind]!.utilization * 100)}% of capacity.`);
      continue;
    }
    const hops = onPath.map((h) => ({ kind: h.kind, ms: ms(h) }));
    flows[f.id] = { ok: true, rate: r.rate, latencyMs: hops.reduce((t, h) => t + h.ms, 0), hops, path: onPath.map((h) => h.kind) };
  }

  let bottleneck: SimResult["bottleneck"];
  for (const [k, v] of Object.entries(load) as [NodeKind, { utilization: number }][])
    if (!bottleneck || v.utilization > bottleneck.utilization) bottleneck = { kind: k, utilization: v.utilization };

  const costPerMonth = design.nodes.reduce((t, n) => t + catalog[n.kind].costPerMonth * (n.kind === "client" ? 0 : n.count), 0);
  return { flows, load, edgeRates, bottleneck, costPerMonth };
}

/** What happens if one machine of a kind fails. */
export function failureOverride(design: Design, kind: NodeKind): { override: Partial<Record<NodeKind, number>>; note: string } {
  const n = design.nodes.find((x) => x.kind === kind);
  if (!n) return { override: {}, note: "" };
  if (kind === "sql") {
    const replicas = design.nodes.find((x) => x.kind === "replica")?.count ?? 0;
    return replicas > 0
      ? { override: { replica: replicas - 1 }, note: "The SQL primary fails; a replica is promoted to take its place." }
      : { override: { sql: 0 }, note: "The SQL primary fails and there's no replica to promote." };
  }
  if (catalog[kind].external) return { override: { [kind]: 0 }, note: `The ${catalog[kind].label.toLowerCase()} has an outage.` };
  return { override: { [kind]: n.count - 1 }, note: `One ${catalog[kind].label.toLowerCase()} machine fails (${n.count} → ${n.count - 1}).` };
}

export const fmtLatency = (ms: number) => (Number.isFinite(ms) ? `${Math.round(ms)} ms` : "fails");
export const fmtPct = (u: number) => `${Math.round(u * 100)}%`;
export const fmtRate = (r: number) => (r >= 1000 ? `${Number((r / 1000).toFixed(r >= 10_000 ? 0 : 1))}k/s` : `${Math.round(r)}/s`);
