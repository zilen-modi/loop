// Verifies the content, so no answer key or test can be wrong:
// - every worked example matches the JS reference solution
// - the brute-force solution agrees with the reference on all small tests (so tests are right)
// - the reference passes the scale test in time, and the brute force does not
// - the Python reference gives the same answers as the JS one on every test
// - each bug-hunt snippet really fails, and checkpoints' answer keys are computed, not typed
// - machine-coding references pass every scenario in both languages; the starter code fails
// - each design lab's reference passes every check; the naive and empty designs, and the reference with
//   one machine per component, do not
import { spawnSync } from "node:child_process";
import { Worker } from "node:worker_threads";
import { problems, problemById } from "../content/problems";
import { checkpoints, correctIndex } from "../content/checkpoints";
import { compile, deepEqual, preview, snake, type BuildProblem, type CodeProblem, type DesignProblem } from "../content/problem-types";
import { buildScenarioCases, compileClass, judgeScenario, runSteps } from "../lib/scenarios";
import { buildCases } from "../lib/tests";
import { designScenarios } from "../content/designs";
import { evaluate } from "../lib/design/evaluate";

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.log(`  ✗ ${msg}`);
};
const ok = (msg: string) => console.log(`  ✓ ${msg}`);

function timeInWorker(source: string, fnName: string, args: unknown[], timeoutMs: number): Promise<{ ms?: number; result?: unknown; timedOut?: boolean }> {
  return new Promise((resolve) => {
    const w = new Worker(
      `const { parentPort, workerData } = require("node:worker_threads");
       const fn = new Function(workerData.source + "\\nreturn " + workerData.fnName + ";")();
       const t0 = performance.now();
       const result = fn(...workerData.args);
       parentPort.postMessage({ ms: performance.now() - t0, result });`,
      { eval: true, workerData: { source, fnName, args } },
    );
    const t = setTimeout(() => {
      w.terminate();
      resolve({ timedOut: true });
    }, timeoutMs);
    w.on("message", (m) => {
      clearTimeout(t);
      w.terminate();
      resolve(m);
    });
  });
}

function runPython(p: CodeProblem, cases: { args: unknown[] }[]) {
  const harness = `
import json, sys, time
src = sys.stdin.readline()
cases = json.loads(sys.stdin.readline())
ns = {}
exec(json.loads(src), ns)
fn = ns[${JSON.stringify(p.fn.py)}]
out = []
for c in cases:
    t0 = time.perf_counter()
    r = fn(*c["args"])
    out.append({"got": r, "ms": (time.perf_counter() - t0) * 1000})
print(json.dumps(out))`;
  const input = JSON.stringify(p.solution.py) + "\n" + JSON.stringify(cases) + "\n";
  const res = spawnSync("python3", ["-c", harness], { input, maxBuffer: 1 << 30, encoding: "utf8" });
  if (res.status !== 0) throw new Error(res.stderr);
  return JSON.parse(res.stdout) as { got: unknown; ms: number }[];
}

async function checkCode(p: CodeProblem) {
  console.log(`\n${p.n}. ${p.title} (${p.id})`);
  const ref = compile(p.solution.js, p.fn.js);
  const brute = compile(p.brute, p.fn.js);

  p.examples.forEach((e, i) => {
    const got = ref(...structuredClone(e.args));
    if (deepEqual(got, e.output)) ok(`example ${i + 1} = ${preview(e.output)}`);
    else fail(`example ${i + 1}: written ${preview(e.output)}, reference gives ${preview(got)}`);
  });

  const small = buildCases(p, "submit", "js").filter((c) => c.group !== "scale");
  const disagree = small.filter((c) => !deepEqual(brute(...structuredClone(c.args)), c.expected));
  if (disagree.length) fail(`brute force disagrees on ${disagree.length} cases, e.g. ${disagree[0].label}`);
  else ok(`brute force agrees with the reference on ${small.length} small cases`);

  for (const lang of ["js", "py"] as const) {
    const scale = buildCases(p, "submit", lang).find((c) => c.group === "scale")!;
    if (lang === "js") {
      const r = await timeInWorker(p.solution.js, p.fn.js, scale.args, scale.limitMs * 4);
      if (r.timedOut || r.ms === undefined) fail(`JS reference timed out on the scale test`);
      else if (!deepEqual(r.result, scale.expected)) fail(`JS reference wrong on scale test`);
      else ok(`JS reference: scale test in ${Math.round(r.ms)} ms (limit ${scale.limitMs} ms in the browser)`);
      if (p.scaleSeparates === false) {
        ok("scale test checks correctness at size only (the naive approach is also linear)");
        continue;
      }
      const b = await timeInWorker(p.brute, p.fn.js, scale.args, scale.limitMs * 3);
      if (b.timedOut || (b.ms ?? 0) > scale.limitMs) ok(`brute force misses the scale limit (${b.timedOut ? "stopped" : Math.round(b.ms!) + " ms"})`);
      else fail(`brute force passes the scale test in ${Math.round(b.ms!)} ms; the scale test doesn't separate O(n) from slower solutions`);
    }
  }

  // Python: same answers as JS on every small case, plus the Python-sized scale case.
  const pyCases = [...small, buildCases(p, "submit", "py").find((c) => c.group === "scale")!];
  try {
    const out = runPython(p, pyCases);
    const wrong = out.filter((o, i) => !deepEqual(o.got, pyCases[i].expected));
    if (wrong.length) fail(`Python reference differs on ${wrong.length} cases`);
    else ok(`Python reference matches on ${pyCases.length} cases (scale: ${Math.round(out[out.length - 1].ms)} ms in CPython; Pyodide is slower, limit ${p.scale.py.limitMs} ms)`);
  } catch (e) {
    fail(`Python reference crashed: ${(e as Error).message.split("\n").slice(-3).join(" ")}`);
  }
}

function runPythonScenarios(p: BuildProblem, cases: { steps: { call: string; args: unknown[] }[] }[]) {
  const harness = `
import json, sys, time
src = json.loads(sys.stdin.readline())
cases = json.loads(sys.stdin.readline())
ns = {}
exec(src, ns)
cls = ns[${JSON.stringify(p.className)}]
out = []
for steps in cases:
    obj = cls()
    res = []
    t0 = time.perf_counter()
    for name, args in steps:
        try:
            res.append({"ok": True, "got": getattr(obj, name)(*args)})
        except Exception as e:
            res.append({"threw": True, "message": str(e)})
    out.append({"got": res, "ms": (time.perf_counter() - t0) * 1000})
print(json.dumps(out))`;
  const wire = cases.map((c) => c.steps.map((st) => [snake(st.call), st.args]));
  const res = spawnSync("python3", ["-c", harness], { input: JSON.stringify(p.solution.py) + "\n" + JSON.stringify(wire) + "\n", maxBuffer: 1 << 30, encoding: "utf8" });
  if (res.status !== 0) throw new Error(res.stderr);
  return JSON.parse(res.stdout) as { got: unknown; ms: number }[];
}

function checkBuild(p: BuildProblem) {
  console.log(`\n${p.n}. ${p.title} (${p.id})`);
  const cases = buildScenarioCases(p, "submit", "extension");
  const ref = compileClass(p.solution.js, p.className);
  for (const c of cases) {
    const t0 = performance.now();
    const got = runSteps(ref, c.steps);
    const v = judgeScenario(c, { kind: "ok", got, ms: performance.now() - t0 });
    if (v.pass) ok(`JS reference passes "${c.name}" (${c.steps.length} steps, ${Math.round(v.ms ?? 0)} ms)`);
    else fail(`JS reference fails "${c.name}": ${v.detail}`);
  }
  try {
    const py = runPythonScenarios(p, cases);
    cases.forEach((c, i) => {
      const v = judgeScenario(c, { kind: "ok", got: py[i].got, ms: py[i].ms });
      if (!v.pass) fail(`Python reference fails "${c.name}": ${v.detail}`);
    });
    if (cases.every((c, i) => judgeScenario(c, { kind: "ok", got: py[i].got, ms: py[i].ms }).pass)) ok(`Python reference passes all ${cases.length} scenarios`);
  } catch (e) {
    fail(`Python reference crashed: ${(e as Error).message.split("\n").slice(-3).join(" ")}`);
  }
  const starter = compileClass(p.starter.js, p.className);
  const core = buildScenarioCases(p, "submit", "core");
  const starterPasses = core.filter((c) => judgeScenario(c, { kind: "ok", got: runSteps(starter, c.steps), ms: 0 }).pass).length;
  if (starterPasses < core.length) ok(`starter code fails ${core.length - starterPasses} of ${core.length} core scenarios (tests aren't trivial)`);
  else fail("starter code passes every core scenario");
}

function checkDesign(p: DesignProblem) {
  console.log(`\n${p.n}. ${p.title} (${p.id})`);
  const s = designScenarios[p.scenarioId];
  if (!s) return fail(`design scenario "${p.scenarioId}" missing`);
  for (const d of s.decisions) {
    const v = s.reference.decisions[d.id];
    if (!d.options.some((o) => o.value === v)) fail(`reference decision "${d.id}" = ${v} isn't an option`);
  }
  const ref = evaluate(s, s.reference);
  const bad = ref.checks.filter((c) => !c.pass);
  if (bad.length) bad.forEach((c) => fail(`reference fails "${c.label}": ${c.detail}`));
  else ok(`reference passes all ${ref.checks.length} checks ($${ref.sim.costPerMonth}/month, ${Math.round(ref.sim.read.latencyMs)} ms redirect)`);
  const variants = {
    naive: s.naive,
    empty: s.start,
    "one machine each": { ...s.reference, nodes: s.reference.nodes.map((n) => ({ ...n, count: 1 })) },
  };
  for (const [name, d] of Object.entries(variants)) {
    const failed = evaluate(s, d).checks.filter((c) => !c.pass);
    if (failed.length) ok(`${name} design fails ${failed.length} check(s): ${failed.map((c) => c.id).join(", ")}`);
    else fail(`${name} design passes every check`);
  }
}

async function main() {
  for (const p of problems) {
    if (p.kind === "code") await checkCode(p);
    else if (p.kind === "build") checkBuild(p);
    else if (p.kind === "design") checkDesign(p);
    else {
      console.log(`\n${p.n}. ${p.title} (${p.id})`);
      const target = problemById(p.referenceProblemId);
      if (!target || target.kind !== "code") {
        fail("reference problem missing");
        continue;
      }
      const buggy = compile(p.lines.join("\n"), p.fnName);
      const ref = compile(target.solution.js, target.fn.js);
      const exposed = p.probeCases.filter((c) => !deepEqual(buggy(...structuredClone(c)), ref(...structuredClone(c))));
      if (exposed.length) ok(`the bug shows on ${exposed.length} of ${p.probeCases.length} probe cases`);
      else fail("the 'buggy' code passes every probe case");
      if (p.reasonIndex >= 0 && p.reasonIndex < p.reasons.length) ok(`bug on line ${p.bugLine + 1}: ${p.lines[p.bugLine].trim()}`);
      else fail("reason index out of range");
    }
  }

  console.log("\nCheckpoints");
  for (const c of Object.values(checkpoints)) {
    const i = correctIndex(c);
    const matches = c.compute ? c.options.filter((o) => o === c.compute!()).length : 1;
    if (i < 0 || matches !== 1) fail(`${c.id}: computed answer ${c.compute?.()} isn't exactly one of the options`);
    else ok(`${c.id}: ${c.options[i]}${c.compute ? " (computed)" : ""}`);
  }

  console.log(failures ? `\n${failures} problem(s) found.` : "\nAll content checks passed.");
  process.exit(failures ? 1 : 0);
}

main();
