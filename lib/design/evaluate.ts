import { catalog, failureOverride, simulate, type Design, type NodeKind, type SimResult, type Traffic } from "./sim";

export type Decision = {
  id: string;
  question: string;
  options: { value: string; label: string; consequence: string }[];
};

export type Ctx = { design: Design; sim: SimResult; failures: { kind: NodeKind; note: string; sim: SimResult }[] };

export type Criterion = { id: string; label: string; check: (c: Ctx) => { pass: boolean; detail: string } };

export type DesignScenario = {
  id: string;
  title: string;
  statement: string;
  functional: string[];
  nonFunctional: string[];
  /** The back-of-the-envelope numbers, with the working shown. */
  estimates: { label: string; value: string; how: string }[];
  traffic: Traffic;
  decisions: Decision[];
  criteria: Criterion[];
  start: Design;
  reference: Design;
  /** A design that looks plausible but should fail; check-content makes sure it does. */
  naive: Design;
  hints: [string, string, string];
  walkthrough: { summary: string; steps: string[]; tradeoffs: string[]; followUps: string[] };
};

export type CheckResult = { id: string; label: string; pass: boolean; detail: string };

export type Evaluation = Ctx & { checks: CheckResult[] };

export function evaluate(s: DesignScenario, design: Design): Evaluation {
  const sim = simulate(design, s.traffic);
  const failures = design.nodes
    .filter((n) => n.kind !== "client" && n.kind !== "cdn" && n.count > 0)
    .map((n) => {
      const { override, note } = failureOverride(design, n.kind);
      return { kind: n.kind, note, sim: simulate(design, s.traffic, override) };
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
