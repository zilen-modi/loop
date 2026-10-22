import { compile, deepEqual, mulberry32, preview, type CodeProblem, type Lang } from "@/content/problem-types";
import type { CaseOutcome } from "@/lib/runner";

export type TestCase = {
  label: string;
  group: "example" | "edge" | "hidden" | "scale";
  args: unknown[];
  expected: unknown;
  limitMs: number;
  note?: string;
};

const NORMAL_LIMIT_MS = 2000;

/** Run = the worked examples. Submit = examples, edge cases, seeded random cases and one scale case. */
export function buildCases(p: CodeProblem, mode: "run" | "submit", lang: Lang): TestCase[] {
  const reference = compile(p.solution.js, p.fn.js);
  const expectedFor = (args: unknown[]) => reference(...structuredClone(args));

  const cases: TestCase[] = p.examples.map((e, i) => ({
    label: `Example ${i + 1}`,
    group: "example",
    args: e.args,
    expected: e.output,
    limitMs: NORMAL_LIMIT_MS,
  }));
  if (mode === "run") return cases;

  p.edgeCases.forEach((args, i) => cases.push({ label: `Edge case ${i + 1}`, group: "edge", args, expected: expectedFor(args), limitMs: NORMAL_LIMIT_MS }));

  const rand = mulberry32(hash(p.id));
  for (let i = 0; i < p.random.count; i++) {
    const args = p.random.gen(rand);
    cases.push({ label: `Hidden ${i + 1}`, group: "hidden", args, expected: expectedFor(args), limitMs: NORMAL_LIMIT_MS });
  }

  const scale = p.scale[lang];
  const scaleArgs = scale.gen(mulberry32(hash(p.id + ":scale")));
  cases.push({
    label: "Scale",
    group: "scale",
    args: scaleArgs,
    expected: expectedFor(scaleArgs),
    limitMs: scale.limitMs,
    note: `${scale.n}, within ${(scale.limitMs / 1000).toLocaleString()} s (target ${p.scale.target})`,
  });
  return cases;
}

export type Verdict = {
  label: string;
  group: TestCase["group"];
  pass: boolean;
  status: "pass" | "wrong" | "error" | "slow" | "timeout" | "skipped";
  ms?: number;
  detail?: string;
  args?: string;
  expected?: string;
  got?: string;
};

export function judge(cases: TestCase[], outcomes: CaseOutcome[]): Verdict[] {
  return cases.map((c, i) => {
    const o = outcomes[i];
    const base = { label: c.label, group: c.group, args: c.group === "scale" ? c.note : c.args.map((a) => preview(a, 60)).join(", "), expected: preview(c.expected) };
    if (!o || o.kind === "skipped") return { ...base, pass: false, status: "skipped" };
    if (o.kind === "timeout") return { ...base, pass: false, status: "timeout", detail: `Stopped after ${(o.limitMs * 2 / 1000).toFixed(1)} s.` };
    if (o.kind === "error") return { ...base, pass: false, status: "error", ms: o.ms, detail: o.message };
    if (!deepEqual(o.got, c.expected)) return { ...base, pass: false, status: "wrong", ms: o.ms, got: preview(o.got) };
    if (o.ms > c.limitMs) return { ...base, pass: false, status: "slow", ms: o.ms, got: preview(o.got), detail: `Correct, but took ${Math.round(o.ms).toLocaleString()} ms; the limit is ${c.limitMs.toLocaleString()} ms.` };
    return { ...base, pass: true, status: "pass", ms: o.ms, got: preview(o.got) };
  });
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
