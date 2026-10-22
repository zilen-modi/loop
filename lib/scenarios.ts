import { deepEqual, mulberry32, preview, snake, type BuildProblem, type Lang, type Step } from "@/content/problem-types";

/** Python runs in the browser through WebAssembly, several times slower than JavaScript. */
export const PY_SLOWER = 4;

// Machine-coding scenarios: each is a list of calls on a fresh instance of the class under test.

export type StepOutcome = { ok: true; got: unknown } | { threw: true; message: string };

export type ScenarioCase = { name: string; stage: "core" | "extension"; steps: Step[]; limitMs: number; generated?: boolean };

const SCENARIO_LIMIT_MS = 2000;

export function compileClass(source: string, className: string): new () => Record<string, (...a: unknown[]) => unknown> {
  return new Function(`${source}\nreturn ${className};`)();
}

/** Runs steps against a class in this thread (used for the trusted JS reference only). */
export function runSteps(Cls: new () => Record<string, (...a: unknown[]) => unknown>, steps: Step[]): StepOutcome[] {
  const obj = new Cls();
  return steps.map((s) => {
    try {
      const got = obj[s.call](...structuredClone(s.args));
      return { ok: true, got: got === undefined ? null : structuredClone(got) };
    } catch (e) {
      return { threw: true, message: e instanceof Error ? e.message : String(e) };
    }
  });
}

/** Generated steps get their expectations from the JS reference solution. */
export function withExpectations(p: BuildProblem, steps: Step[]): Step[] {
  const outcomes = runSteps(compileClass(p.solution.js, p.className), steps);
  return steps.map((s, i) => {
    const o = outcomes[i];
    if ("threw" in o) return { ...s, throws: true };
    return o.got === null ? s : { ...s, expect: o.got };
  });
}

const stages = (stage: "core" | "extension") => (stage === "core" ? ["core"] : ["core", "extension"]);

/** Run = the visible scenarios for this stage. Submit = all scenarios up to this stage, generated ones included. */
export function buildScenarioCases(p: BuildProblem, mode: "run" | "submit", stage: "core" | "extension", lang: Lang = "js"): ScenarioCase[] {
  const allowed = stages(stage);
  const hand = p.scenarios
    .filter((s) => allowed.includes(s.stage) && (mode === "submit" || s.visible))
    .map((s) => ({ name: s.name, stage: s.stage, steps: s.steps, limitMs: lang === "py" ? SCENARIO_LIMIT_MS * 2 : SCENARIO_LIMIT_MS }));
  if (mode === "run") return hand;
  const gen = p.generated
    .filter((g) => allowed.includes(g.stage))
    .map((g, i) => ({
      name: g.name,
      stage: g.stage,
      steps: withExpectations(p, g.gen(mulberry32(1000 + p.generated.indexOf(g)))),
      limitMs: lang === "py" ? (g.pyLimitMs ?? g.limitMs * PY_SLOWER) : g.limitMs,
      generated: true,
    }));
  return [...hand, ...gen];
}

/** What gets sent to the worker: Python method names are snake_case. */
export const wireSteps = (steps: Step[], lang: Lang) => steps.map((s) => ({ call: lang === "py" ? snake(s.call) : s.call, args: s.args }));

export type ScenarioVerdict = {
  name: string;
  stage: "core" | "extension";
  pass: boolean;
  status: "pass" | "fail" | "error" | "slow" | "timeout" | "skipped";
  ms?: number;
  steps: number;
  failedStep?: number;
  detail?: string;
};

export function judgeScenario(c: ScenarioCase, outcome: { kind: string; got?: unknown; ms?: number; message?: string; limitMs?: number }): ScenarioVerdict {
  const base = { name: c.name, stage: c.stage, steps: c.steps.length };
  if (outcome.kind === "skipped") return { ...base, pass: false, status: "skipped" };
  if (outcome.kind === "timeout") return { ...base, pass: false, status: "timeout", detail: `Stopped: took longer than ${((c.limitMs * 2) / 1000).toFixed(0)} s.` };
  if (outcome.kind === "error") return { ...base, pass: false, status: "error", ms: outcome.ms, detail: outcome.message };
  const results = (outcome.got as StepOutcome[]) ?? [];
  for (let i = 0; i < c.steps.length; i++) {
    const step = c.steps[i];
    const r = results[i];
    const call = `${step.call}(${step.args.map((a) => preview(a, 40)).join(", ")})`;
    const where = `Step ${i + 1} of ${c.steps.length}: ${call}`;
    if (!r) return { ...base, pass: false, status: "fail", failedStep: i, ms: outcome.ms, detail: `${where}\nThe constructor failed or the run stopped early.` };
    if (step.throws) {
      if (!("threw" in r)) return { ...base, pass: false, status: "fail", failedStep: i, ms: outcome.ms, detail: `${where}\nExpected an error (invalid input), but it returned ${preview(r.got)}.` };
      continue;
    }
    if ("threw" in r) return { ...base, pass: false, status: "fail", failedStep: i, ms: outcome.ms, detail: `${where}\nUnexpected error: ${r.message}` };
    if (step.expect !== undefined && !deepEqual(r.got, step.expect))
      return { ...base, pass: false, status: "fail", failedStep: i, ms: outcome.ms, detail: `${where}\nExpected ${preview(step.expect, 120)}\nGot      ${preview(r.got, 120)}${step.note ? `\n(${step.note})` : ""}` };
  }
  if ((outcome.ms ?? 0) > c.limitMs) return { ...base, pass: false, status: "slow", ms: outcome.ms, detail: `Correct, but took ${Math.round(outcome.ms!)} ms; the limit is ${c.limitMs} ms.` };
  return { ...base, pass: true, status: "pass", ms: outcome.ms };
}
