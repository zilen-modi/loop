"use client";

import type { Lang } from "@/content/problem-types";

// Runs untrusted solution code off the main thread. JavaScript gets a fresh Worker per run;
// Python runs in a long-lived Pyodide Worker (loading Python takes a few seconds the first time).
// A run that overruns its time budget is stopped by terminating the worker.

export const PYODIDE_VERSION = "314.0.7";
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

export type RunCase = { args: unknown[]; limitMs: number };
export type CaseOutcome =
  | { kind: "ok"; got: unknown; ms: number }
  | { kind: "error"; message: string; ms: number }
  | { kind: "timeout"; limitMs: number }
  | { kind: "skipped" };

export type RunOutcome =
  | { kind: "compile-error"; message: string }
  | { kind: "ran"; cases: CaseOutcome[] };

const jsWorkerSource = `
self.onmessage = (e) => {
  const { code, fnName, cases } = e.data;
  let fn;
  try {
    fn = new Function(code + "\\n;return typeof " + fnName + " === 'function' ? " + fnName + " : undefined;")();
  } catch (err) {
    self.postMessage({ type: "compile", message: String((err && err.message) || err) });
    return;
  }
  if (typeof fn !== "function") {
    self.postMessage({ type: "compile", message: "Define a function named " + fnName + "." });
    return;
  }
  self.postMessage({ type: "ready" });
  for (let i = 0; i < cases.length; i++) {
    const t0 = performance.now();
    try {
      const got = fn(...cases[i].args);
      self.postMessage({ type: "case", i, got, ms: performance.now() - t0 });
    } catch (err) {
      self.postMessage({ type: "case", i, error: String((err && err.message) || err), ms: performance.now() - t0 });
    }
  }
  self.postMessage({ type: "done" });
};`;

const pyWorkerSource = (`
// Current Pyodide runs in module workers only; tell it where its files live.
const BASE = ${JSON.stringify("__BASE__")};
const ready = import(BASE + "pyodide.mjs")
  .then((m) => m.loadPyodide({ indexURL: BASE }))
  .then(async (py) => { await py.runPythonAsync("import json"); return py; });
self.onmessage = async (e) => {
  const { code, fnName, cases } = e.data;
  let py;
  try { py = await ready; } catch (err) {
    self.postMessage({ type: "compile", message: "Couldn't load Python: " + String(err && err.message || err) });
    return;
  }
  const ns = py.globals.get("dict")();
  ns.set("json", py.pyimport("json"));
  const lastLine = (err) => {
    const text = String((err && err.message) || err).trim().split("\\n");
    const tail = text.filter((l) => l.trim()).slice(-3).join("\\n");
    return tail.replace(/File "<exec>", /g, "");
  };
  try {
    py.runPython(code, { globals: ns });
  } catch (err) {
    self.postMessage({ type: "compile", message: lastLine(err) });
    ns.destroy();
    return;
  }
  if (!ns.has(fnName)) {
    self.postMessage({ type: "compile", message: "Define a function named " + fnName + "." });
    ns.destroy();
    return;
  }
  self.postMessage({ type: "ready" });
  for (let i = 0; i < cases.length; i++) {
    try {
      ns.set("__args_json", JSON.stringify(cases[i].args));
      py.runPython("__args = json.loads(__args_json)", { globals: ns });
      const t0 = performance.now();
      py.runPython("__result = " + fnName + "(*__args)", { globals: ns });
      const ms = performance.now() - t0;
      const out = py.runPython("json.dumps(__result)", { globals: ns });
      self.postMessage({ type: "case", i, got: JSON.parse(out), ms });
    } catch (err) {
      self.postMessage({ type: "case", i, error: lastLine(err), ms: 0 });
    }
  }
  ns.destroy();
  self.postMessage({ type: "done" });
};`).replace("__BASE__", PYODIDE_BASE);

let pyWorker: Worker | null = null;
let pyLoaded = false;

const blobWorker = (source: string, type: WorkerType = "classic") => new Worker(URL.createObjectURL(new Blob([source], { type: "text/javascript" })), { type });

export const pythonReady = () => pyLoaded;

/** Starts downloading Python early (e.g. when the Python tab is picked). */
export function warmPython() {
  if (!pyWorker) pyWorker = blobWorker(pyWorkerSource, "module");
}

export function runCases(
  lang: Lang,
  code: string,
  fnName: string,
  cases: RunCase[],
  onProgress?: (done: number, phase: "loading" | "running") => void,
): Promise<RunOutcome> {
  return new Promise((resolve) => {
    const worker = lang === "js" ? blobWorker(jsWorkerSource) : (warmPython(), pyWorker!);
    const results: CaseOutcome[] = cases.map(() => ({ kind: "skipped" }));
    let current = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Python's first run includes downloading and starting the interpreter.
    const startupMs = lang === "py" && !pyLoaded ? 60_000 : 5_000;

    const finish = (outcome: RunOutcome, kill = false) => {
      clearTimeout(timer);
      worker.onmessage = null;
      if (lang === "js" || kill) worker.terminate();
      if (lang === "py" && kill) {
        pyWorker = null; // a stuck Python worker is replaced on the next run
        pyLoaded = false;
      }
      resolve(outcome);
    };

    // Each case gets its own budget: the stated limit plus slack for message passing.
    const arm = (ms: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (current < cases.length) results[current] = { kind: "timeout", limitMs: cases[current].limitMs };
        finish({ kind: "ran", cases: results }, true);
      }, ms);
    };

    worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === "compile") finish({ kind: "compile-error", message: m.message }, lang === "js");
      else if (m.type === "ready") {
        if (lang === "py") pyLoaded = true;
        onProgress?.(0, "running");
        if (cases.length) arm(cases[0].limitMs * 2 + 1000);
      } else if (m.type === "case") {
        results[m.i] = m.error !== undefined ? { kind: "error", message: m.error, ms: m.ms } : { kind: "ok", got: m.got, ms: m.ms };
        current = m.i + 1;
        onProgress?.(current, "running");
        if (current < cases.length) arm(cases[current].limitMs * 2 + 1000);
      } else if (m.type === "done") finish({ kind: "ran", cases: results });
    };
    worker.onerror = (e) => {
      e.preventDefault();
      finish({ kind: "compile-error", message: e.message || "The code couldn't run." }, true);
    };

    onProgress?.(0, lang === "py" && !pyLoaded ? "loading" : "running");
    arm(startupMs + (cases[0]?.limitMs ?? 0) * 2);
    worker.postMessage({ code, fnName, cases: cases.map((c) => ({ args: c.args })) });
  });
}
