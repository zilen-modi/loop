import { catalog, type NodeKind } from "./catalog";
import { failureOverride, simulate, type FlowDef, type SimResult, type Traffic } from "./engine";
import type { Design } from "./graph";

export type Decision = {
  id: string;
  question: string;
  options: { value: string; label: string; consequence: string }[];
};

export type Ctx = { design: Design; sim: SimResult; failures: { kind: NodeKind; note: string; sim: SimResult }[] };

export type Criterion = {
  id: string;
  label: string;
  /** A few words for the scorecard pill. */
  short?: string;
  check: (c: Ctx) => { pass: boolean; detail: string };
  /** Which boxes this check is about, for highlighting on the canvas. Defaults to all of them. */
  focus?: (c: Ctx) => NodeKind[];
};

export type DesignScenario = {
  id: string;
  title: string;
  statement: string;
  functional: string[];
  nonFunctional: string[];
  /** The back-of-the-envelope numbers, with the working shown. */
  estimates: { label: string; value: string; how: string }[];
  /** Peak traffic. Keys ending in "PerSec" scale with the traffic slider; the rest (hit rates) don't. */
  traffic: Traffic;
  /** How requests move through a design. */
  flows: FlowDef[];
  /** Flows shown as live tiles. The first is the slow path: its latency breakdown and the request trace. */
  metrics: { flow: string; label: string }[];
  /** Describes traffic at a share of peak, for the slider ("2k/s redirects"). */
  trafficLabel: (scale: number) => string;
  decisions: Decision[];
  criteria: Criterion[];
  start: Design;
  reference: Design;
  /** A design that looks plausible but should fail; check-content makes sure it does. */
  naive: Design;
  /** Common wrong designs, each failing one specific check (verified by check-content). */
  wrong: { name: string; design: Design; fails: string }[];
  /** Flows that may pause, by design, when a component fails (e.g. deliveries wait while a provider is down). */
  tolerates?: Partial<Record<NodeKind, { flows: string[]; why: string }>>;
  /** The reference design's numbers, pinned so engine or catalog changes can't move them silently. */
  pinned?: { cost: number; latencyMs: Record<string, number>; utilization: Partial<Record<NodeKind, number>> };
  hints: [string, string, string];
  walkthrough: { summary: string; steps: string[]; tradeoffs: string[]; followUps: string[] };
};

export type CheckResult = { id: string; label: string; pass: boolean; detail: string };

export type Evaluation = Ctx & { checks: CheckResult[] };

export function evaluate(s: DesignScenario, design: Design): Evaluation {
  const sim = simulate(s, design);
  const failures = design.nodes
    .filter((n) => n.kind !== "client" && n.kind !== "cdn" && n.count > 0)
    .map((n) => {
      const { override, note } = failureOverride(design, n.kind);
      return { kind: n.kind, note, sim: simulate(s, design, override) };
    });
  const ctx: Ctx = { design, sim, failures };
  return { ...ctx, checks: s.criteria.map((c) => ({ id: c.id, label: c.label, ...c.check(ctx) })) };
}

/** Machines running above `limit` of capacity. */
export function hotSpots(sim: SimResult, limit: number) {
  return (Object.entries(sim.load) as [NodeKind, { utilization: number }][])
    .filter(([, v]) => v.utilization > limit)
    .map(([k, v]) => `${catalog[k].label} at ${Math.round(v.utilization * 100)}%`);
}

/** The boxes a set of flows passes through, for highlighting. */
export const pathsOf = (sim: SimResult, ids: string[]) => [...new Set(ids.flatMap((id) => sim.flows[id]?.path ?? []))];
