// Verifies the content, so no answer key or test can be wrong:
// - every worked example matches the JS reference solution
// - the brute-force solution agrees with the reference on all small tests (so tests are right)
// - the reference passes the scale test in time, and the brute force does not
// - the Python reference gives the same answers as the JS one on every test
// - each bug-hunt snippet really fails, and checkpoints' answer keys are computed, not typed
import { spawnSync } from "node:child_process";
import { Worker } from "node:worker_threads";
import { problems, problemById } from "../content/problems";
import { checkpoints, correctIndex } from "../content/checkpoints";
import { compile, deepEqual, preview, type CodeProblem } from "../content/problem-types";
import { buildCases } from "../lib/tests";

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

async function main() {
  for (const p of problems) {
    if (p.kind === "code") await checkCode(p);
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
