// Shape of a problem. Statements, examples and tests are original (set in the Tiffin world);
// the LeetCode link is only a reference to the classic problem with the same shape.

export type Lang = "js" | "py";
export type Level = "Easy" | "Medium" | "Hard";
export type Args = unknown[];

export type Rand = () => number; // seeded, 0 ≤ x < 1

export type CodeProblem = {
  kind: "code";
  id: string;
  chapter: string;
  n: number;
  title: string;
  level: Level;
  shape: string;
  reference: { label: string; url: string };
  rounds: string[];
  /** Short markdown: paragraphs, `code`, **bold**. */
  statement: string;
  params: string[];
  examples: { args: Args; output: unknown; note?: string }[];
  constraints: string[];
  fn: Record<Lang, string>;
  starter: Record<Lang, string>;
  /** Reference solutions. The JS one computes expected outputs for hidden and scale tests. */
  solution: Record<Lang, string>;
  /** A correct but slow solution; the content check proves it fails the scale test. */
  brute: string;
  /** false when the naive approach is also linear (the scale test then only checks correctness at size). */
  scaleSeparates?: boolean;
  edgeCases: Args[];
  random: { count: number; gen: (rand: Rand) => Args };
  scale: { target: string; js: { n: string; limitMs: number; gen: (rand: Rand) => Args }; py: { n: string; limitMs: number; gen: (rand: Rand) => Args } };
  hints: [string, string, string];
  walkthrough: { idea: string; complexity: string; pitfalls: string[]; followUps: string[] };
};

export type BugHuntProblem = {
  kind: "bug-hunt";
  id: string;
  chapter: string;
  n: number;
  title: string;
  level: Level;
  shape: string;
  rounds: string[];
  statement: string;
  /** The teammate's code, one entry per line. */
  lines: string[];
  fnName: string;
  bugLine: number;
  reasons: string[];
  reasonIndex: number;
  explanation: string;
  /** Inputs that expose the bug: the buggy code must fail at least one, the fixed code must pass all. */
  probeCases: Args[];
  /** The problem whose reference solution defines the right answers. */
  referenceProblemId: string;
};

/** One call in a machine-coding scenario. Omit `expect` when only "doesn't throw" matters. */
export type Step = { call: string; args: unknown[]; expect?: unknown; throws?: boolean; note?: string };

export type Scenario = { name: string; stage: "core" | "extension"; visible?: boolean; steps: Step[] };

/** A machine-coding build: implement a class against a spec; hidden scenarios drive it. */
export type BuildProblem = {
  kind: "build";
  id: string;
  chapter: string;
  n: number;
  title: string;
  level: Level;
  shape: string;
  rounds: string[];
  minutes: number;
  statement: string;
  requirements: { core: string[]; extension: string[] };
  api: { js: string; py: string; does: string; stage: "core" | "extension" }[];
  rules: string[];
  className: string;
  starter: Record<Lang, string>;
  solution: Record<Lang, string>;
  /** Hand-written scenarios with explicit expectations (checked against both reference solutions). */
  scenarios: Scenario[];
  /** Large generated scenarios; expected values come from the JS reference. */
  generated: { name: string; stage: "core" | "extension"; limitMs: number; pyLimitMs?: number; gen: (rand: Rand) => Step[] }[];
  hints: [string, string, string];
  review: string[];
  walkthrough: { design: string; classes: { name: string; role: string }[]; tradeoffs: string[]; followUps: string[] };
  /** Plausible bugs, made by editing the JS reference; check-content makes sure each one fails a scenario. */
  mutants?: { name: string; from: string; to: string }[];
  /** A correct but slow JS version; check-content makes sure the core's timed scenarios reject it. */
  slowVariant?: { name: string; js: string };
};

/** A system-design lab: build an architecture on the canvas; the simulator and rules score it. */
export type DesignProblem = {
  kind: "design";
  id: string;
  chapter: string;
  n: number;
  title: string;
  level: Level;
  shape: string;
  rounds: string[];
  scenarioId: string; // key into content/designs
};

export type Problem = CodeProblem | BugHuntProblem | BuildProblem | DesignProblem;

/** Python method name for a JS-style call name: addExpense → add_expense. */
export const snake = (name: string) => name.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());

/** Small, fast, seeded generator so hidden tests are the same every time. */
export function mulberry32(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randInt = (rand: Rand, lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
export const randArray = (rand: Rand, n: number, lo: number, hi: number) => Array.from({ length: n }, () => randInt(rand, lo, hi));

/** Turns a reference solution's source into a callable function. */
export function compile(source: string, name: string): (...args: unknown[]) => unknown {
  return new Function(`${source}\nreturn ${name};`)() as (...args: unknown[]) => unknown;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    return ka.length === kb.length && ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

/** Short, readable rendering of a value for test reports (huge arrays are summarised). */
export function preview(v: unknown, max = 80): string {
  if (Array.isArray(v) && v.length > 12) return `[${v.slice(0, 6).map((x) => preview(x, 20)).join(", ")}, … ${v.length} items]`;
  const s = JSON.stringify(v);
  return s === undefined ? String(v) : s.length > max ? s.slice(0, max - 1) + "…" : s;
}
