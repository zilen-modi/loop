"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, Lightbulb, Lock, Play, RotateCcw, Send, Sparkles, Timer, X } from "lucide-react";
import type { BuildProblem, Lang } from "@/content/problem-types";
import { buildScenarioCases, judgeScenario, wireSteps, type ScenarioVerdict } from "@/lib/scenarios";
import { runCases, warmPython } from "@/lib/runner";
import { problemsProgress, scheduleSolve, updateProblem } from "@/lib/progress";
import { createLocalStore } from "@/lib/local-store";
import MiniMarkdown from "@/components/ui/MiniMarkdown";
import Editor from "./Editor";

const prefs = createLocalStore<{ lang: Lang }>("loop:bench", { lang: "js" });
const isExtensionRule = (r: string) => /\(extension\)/i.test(r);

/** Machine-coding round: build a class to spec; hidden scenarios check it; the extension unlocks after the core. */
export default function BuildBench({ problem: p, from }: { problem: BuildProblem; from: string }) {
  const { lang } = prefs.use();
  const state = problemsProgress.use()[p.id];
  const stage = state?.stage ?? "core";
  const unlocked = stage === "extension";
  const solved = state?.status === "solved";
  const [code, setCode] = useState(() => state?.code?.[lang] ?? p.starter[lang]);
  const [tab, setTab] = useState<"spec" | "code">("spec");
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<null | { kind: "run" | "submit"; verdicts: ScenarioVerdict[]; compileError?: string }>(null);
  const [justUnlocked, setJustUnlocked] = useState(false);
  const [clock, setClock] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setCode(problemsProgress.get()[p.id]?.code?.[lang] ?? p.starter[lang]);
    setResult(null);
    if (lang === "py") warmPython();
  }, [lang, p.id, p.starter]);

  useEffect(() => {
    if (clock === null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [clock]);

  function onCode(v: string) {
    setCode(v);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => updateProblem(p.id, (s) => ({ ...s, code: { ...s.code, [lang]: v } })), 400);
  }

  async function execute(kind: "run" | "submit") {
    const cases = buildScenarioCases(p, kind, stage);
    setTab("code");
    setRunning(lang === "py" ? "Starting Python…" : "Running…");
    const out = await runCases(
      lang,
      code,
      p.className,
      cases.map((c) => ({ args: [wireSteps(c.steps, lang)], limitMs: c.limitMs })),
      (done, phase) => setRunning(phase === "loading" ? "Loading Python (the first run takes a few seconds)…" : `Running scenario ${Math.min(done + 1, cases.length)} of ${cases.length}…`),
      "scenario",
    );
    setRunning(null);
    if (kind === "submit") updateProblem(p.id, (s) => ({ ...s, attempts: s.attempts + 1 }));
    if (out.kind === "compile-error") {
      setResult({ kind, verdicts: [], compileError: out.message });
      return;
    }
    const verdicts = cases.map((c, i) => {
      const o = out.cases[i];
      return judgeScenario(c, o.kind === "ok" ? { kind: "ok", got: o.got, ms: o.ms } : o.kind === "error" ? { kind: "error", message: o.message, ms: o.ms } : o);
    });
    setResult({ kind, verdicts });
    if (kind === "submit" && verdicts.every((v) => v.pass)) {
      if (stage === "core") {
        updateProblem(p.id, (s) => ({ ...s, stage: "extension" }));
        setJustUnlocked(true);
      } else scheduleSolve(p.id);
    }
  }

  const left = clock === null ? 0 : Math.max(0, clock + p.minutes * 60_000 - now);
  const rules = p.rules.filter((r) => unlocked || !isExtensionRule(r));
  const api = p.api.filter((a) => unlocked || a.stage === "core");

  return (
    <div className="bench">
      <header className="bench-head">
        <Link href={from} className="icon-btn" aria-label="Back"><ChevronLeft size={20} /></Link>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "var(--ink-3)", flexWrap: "wrap" }}>
            <span className={`chip ${p.level.toLowerCase()}`}>{p.level}</span>
            <span>{p.shape}</span>
            <span className={`chip ${unlocked ? "new" : ""}`}>{unlocked ? "Round 2: extension" : "Round 1: core"}</span>
            {solved && <span className="chip easy"><Check size={11} /> Solved</span>}
          </div>
        </div>
        {clock === null ? (
          <button className="btn small" onClick={() => { setClock(Date.now()); setNow(Date.now()); }}><Timer size={14} /> Start the {p.minutes}-minute clock</button>
        ) : (
          <span className="chip" role="timer" aria-label="Time left" style={{ height: 28, fontSize: 13, color: left < 10 * 60_000 ? "var(--fail)" : "var(--ink-2)" }}>
            <Timer size={14} /> {left === 0 ? "Time's up: demo what works" : `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`}
          </span>
        )}
      </header>

      <div className="bench-tabs seg" role="group" aria-label="Show" style={{ margin: "8px 14px 0" }}>
        <button aria-pressed={tab === "spec"} onClick={() => setTab("spec")}>Spec</button>
        <button aria-pressed={tab === "code"} onClick={() => setTab("code")}>Code</button>
      </div>

      <div className="bench-body" data-tab={tab === "spec" ? "problem" : "code"}>
        <section className="bench-pane bench-left" aria-label="Specification">
          {justUnlocked && (
            <div className="card" role="status" style={{ padding: "12px 14px", marginBottom: 16, borderColor: "var(--accent)", background: "var(--accent-soft)" }}>
              <strong style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}><Sparkles size={15} /> Core passed. The interviewer adds:</strong>
              <ul style={{ margin: "6px 0 0", paddingLeft: 20 }}>{p.requirements.extension.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
          )}
          <div className="statement"><MiniMarkdown text={p.statement} /></div>

          <p className="kicker" style={{ margin: "18px 0 6px" }}>Requirements</p>
          <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7, fontSize: 14.5 }}>
            {p.requirements.core.map((r) => <li key={r}>{r}</li>)}
            {unlocked && p.requirements.extension.map((r) => <li key={r} style={{ color: "var(--accent)" }}>{r} <span className="chip new">extension</span></li>)}
          </ul>
          {!unlocked && (
            <p style={{ display: "flex", gap: 6, alignItems: "center", color: "var(--ink-3)", fontSize: 13, margin: "8px 0 0" }}>
              <Lock size={13} /> Pass the core round and the interviewer adds {p.requirements.extension.length} more requirements.
            </p>
          )}

          <p className="kicker" style={{ margin: "20px 0 6px" }}>API ({p.className})</p>
          <div className="card" style={{ overflow: "hidden" }}>
            {api.map((a, i) => (
              <div key={a.js} style={{ padding: "8px 12px", borderTop: i ? "1px solid var(--rule)" : undefined, fontSize: 13.5 }}>
                <code style={{ fontFamily: "var(--mono)", fontSize: 12.5, color: a.stage === "extension" ? "var(--accent)" : "var(--ink)" }}>{lang === "js" ? a.js : a.py}</code>
                <div style={{ color: "var(--ink-2)", marginTop: 2 }}>{a.does}</div>
              </div>
            ))}
          </div>

          <p className="kicker" style={{ margin: "20px 0 6px" }}>Rules the tests check</p>
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.65, fontSize: 14 }}>
            {rules.map((r) => <li key={r} style={{ marginBottom: 4 }}>{r}</li>)}
          </ol>

          <Guidance p={p} unlocked={unlocked || (state?.attempts ?? 0) > 0} />
        </section>

        <section className="bench-pane bench-right" aria-label="Your solution">
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--rule)", flexWrap: "wrap" }}>
            <div className="seg" role="group" aria-label="Language">
              <button aria-pressed={lang === "js"} onClick={() => prefs.set({ lang: "js" })}>JavaScript</button>
              <button aria-pressed={lang === "py"} onClick={() => prefs.set({ lang: "py" })}>Python</button>
            </div>
            <button className="icon-btn" aria-label="Reset to starter code" title="Reset to starter code" onClick={() => onCode(p.starter[lang])}><RotateCcw size={16} /></button>
            <span style={{ flex: 1 }} />
            <div className="bench-actions">
              <button className="btn small" onClick={() => execute("run")} disabled={!!running}><Play size={14} /> Run</button>
              <button className="btn small primary" onClick={() => execute("submit")} disabled={!!running}><Send size={14} /> Submit</button>
            </div>
          </div>
          <Editor value={code} lang={lang} onChange={onCode} label={`${lang === "js" ? "JavaScript" : "Python"} editor for ${p.className}. Press Escape then Tab to leave the editor.`} />
          <div className="bench-status" style={{ padding: "8px 14px", borderBottom: "1px solid var(--rule)", fontSize: 12.5, color: "var(--ink-3)" }} aria-live="polite">
            {running ?? (result ? (result.kind === "run" ? "Ran the visible scenarios" : "Submitted: every scenario for this round, including large generated ones") : "Run checks the visible scenarios. Submit runs every scenario for this round.")}
          </div>
          <ScenarioResults result={result} />
        </section>
      </div>
    </div>
  );
}

function ScenarioResults({ result }: { result: null | { kind: "run" | "submit"; verdicts: ScenarioVerdict[]; compileError?: string } }) {
  if (!result) return <div className="results" />;
  if (result.compileError)
    return (
      <div className="results">
        <p style={{ color: "var(--fail)", fontWeight: 600, margin: "4px 0 8px" }}>Your code didn&apos;t run</p>
        <pre className="example" style={{ color: "var(--fail)" }}>{result.compileError}</pre>
      </div>
    );
  const v = result.verdicts;
  const failed = v.filter((x) => !x.pass);
  const ordered = [...failed, ...v.filter((x) => x.pass)];
  return (
    <div className="results">
      <p role="status" style={{ fontWeight: 600, margin: "4px 0 8px", color: failed.length ? "var(--fail)" : "var(--pass)" }}>
        {failed.length ? `${v.length - failed.length} of ${v.length} scenarios pass` : result.kind === "submit" ? `All ${v.length} scenarios pass` : `All ${v.length} visible scenarios pass`}
      </p>
      {ordered.map((x, i) => (
        <div key={x.name} className="result-row">
          <span aria-hidden="true">{x.pass ? <Check size={15} color="var(--pass)" /> : <X size={15} color="var(--fail)" />}</span>
          <span>{x.name} <span style={{ color: "var(--ink-3)" }}>· {x.steps} calls</span></span>
          <span style={{ color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>{x.ms !== undefined ? `${Math.round(x.ms)} ms` : ""}</span>
          {!x.pass && i === 0 && x.detail && <div className="detail">{x.detail}</div>}
          {!x.pass && i > 0 && x.detail && <div className="detail" style={{ opacity: 0.8 }}>{x.detail.split("\n")[0]}</div>}
        </div>
      ))}
    </div>
  );
}

function Guidance({ p, unlocked }: { p: BuildProblem; unlocked: boolean }) {
  const state = problemsProgress.use()[p.id];
  const used = state?.hintsUsed ?? 0;
  const checks = state?.checks ?? [];
  const [lang, setLang] = useState<Lang>("js");
  const [open, setOpen] = useState(false);
  const labels = ["Nudge", "Approach", "Plan"];
  const canOpen = unlocked || used >= p.hints.length;
  return (
    <div style={{ marginTop: 26, display: "grid", gap: 14 }}>
      <div className="card" style={{ padding: "14px 16px" }}>
        <p className="kicker" style={{ margin: "0 0 8px", display: "flex", gap: 6, alignItems: "center" }}><Lightbulb size={13} /> Hints · {used} of {p.hints.length}</p>
        {p.hints.slice(0, used).map((h, i) => (
          <p key={i} style={{ margin: "0 0 10px", fontFamily: "var(--serif)", fontSize: 15.5, lineHeight: 1.6 }}>
            <span className="kicker" style={{ display: "block", marginBottom: 2 }}>{labels[i]}</span>
            {h}
          </p>
        ))}
        {used < p.hints.length && (
          <button className="btn small" onClick={() => updateProblem(p.id, (s) => ({ ...s, hintsUsed: Math.max(s.hintsUsed, used + 1) }))}>Show {labels[used].toLowerCase()}</button>
        )}
      </div>

      <div className="card" style={{ padding: "14px 16px" }}>
        <p className="kicker" style={{ margin: "0 0 4px" }}>Design review: check your own code</p>
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--ink-3)" }}>Interviewers grade the design too, not just passing tests.</p>
        {p.review.map((r, i) => (
          <label key={r} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "4px 0", fontSize: 14, lineHeight: 1.5, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={checks.includes(i)}
              onChange={() => updateProblem(p.id, (s) => ({ ...s, checks: (s.checks ?? []).includes(i) ? (s.checks ?? []).filter((x) => x !== i) : [...(s.checks ?? []), i] }))}
              style={{ marginTop: 3 }}
            />
            {r}
          </label>
        ))}
      </div>

      {!canOpen ? (
        <div className="card" style={{ padding: "14px 16px", color: "var(--ink-3)", display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}>
          <Lock size={14} /> The reference design opens after you submit once or use all the hints.
        </div>
      ) : !open ? (
        <button className="btn" onClick={() => { setOpen(true); updateProblem(p.id, (s) => ({ ...s, walkthroughSeen: true })); }}>Open the reference design</button>
      ) : (
        <div className="card" style={{ padding: "16px 18px" }}>
          <p className="kicker" style={{ margin: "0 0 8px" }}>Reference design</p>
          <p style={{ fontFamily: "var(--serif)", fontSize: 15.5, lineHeight: 1.65, margin: "0 0 12px" }}>{p.walkthrough.design}</p>
          <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
            {p.walkthrough.classes.map((c) => (
              <div key={c.name} style={{ border: "1px solid var(--rule-2)", borderRadius: 8, padding: "8px 10px" }}>
                <code style={{ fontFamily: "var(--mono)", fontSize: 12.5, fontWeight: 600 }}>{c.name}</code>
                <div style={{ fontSize: 13.5, color: "var(--ink-2)" }}>{c.role}</div>
              </div>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Reference language" style={{ marginBottom: 8 }}>
            <button aria-pressed={lang === "js"} onClick={() => setLang("js")}>JavaScript</button>
            <button aria-pressed={lang === "py"} onClick={() => setLang("py")}>Python</button>
          </div>
          <pre className="example" style={{ whiteSpace: "pre", overflowX: "auto", maxHeight: 420 }}>{p.solution[lang]}</pre>
          <p className="kicker" style={{ margin: "14px 0 4px" }}>Trade-offs to mention</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>{p.walkthrough.tradeoffs.map((x) => <li key={x}>{x}</li>)}</ul>
          <p className="kicker" style={{ margin: "14px 0 4px" }}>Follow-ups interviewers ask</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>{p.walkthrough.followUps.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
