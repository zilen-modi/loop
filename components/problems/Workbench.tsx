"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, ExternalLink, Play, RotateCcw, Send, Timer } from "lucide-react";
import type { CodeProblem, Lang } from "@/content/problem-types";
import { preview } from "@/content/problem-types";
import { buildCases, judge, type Verdict } from "@/lib/tests";
import { runCases, warmPython } from "@/lib/runner";
import { problemsProgress, scheduleSolve, updateProblem } from "@/lib/progress";
import { createLocalStore } from "@/lib/local-store";
import MiniMarkdown from "@/components/ui/MiniMarkdown";
import Editor from "./Editor";
import { HintLadder, Walkthrough } from "./Guidance";
import Results from "./Results";

export type BenchMode = "normal" | "timed" | "mixed";

const prefs = createLocalStore<{ lang: Lang }>("loop:bench", { lang: "js" });
const TIMED_MINUTES = { Easy: 15, Medium: 25, Hard: 40 };

export default function Workbench({ problem: p, from, mode, next }: { problem: CodeProblem; from: string; mode: BenchMode; next?: string }) {
  const { lang } = prefs.use();
  const state = problemsProgress.use()[p.id];
  const [code, setCode] = useState(() => state?.code?.[lang] ?? p.starter[lang]);
  const [tab, setTab] = useState<"problem" | "code">("problem");
  const [running, setRunning] = useState<null | { label: string }>(null);
  const [result, setResult] = useState<null | { kind: "run" | "submit"; verdicts: Verdict[]; compileError?: string }>(null);
  const [deadline] = useState(() => (mode === "timed" ? Date.now() + TIMED_MINUTES[p.level] * 60_000 : 0));
  const [now, setNow] = useState(Date.now());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const solved = state?.status === "solved";
  const timeUp = mode === "timed" && now >= deadline;
  const helpAllowed = mode !== "timed" || timeUp || !!result?.verdicts.every((v) => v.pass);
  const reveal = mode !== "mixed" || solved;

  useEffect(() => {
    if (mode !== "timed") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [mode]);

  // Load saved code when the language changes.
  useEffect(() => {
    setCode(problemsProgress.get()[p.id]?.code?.[lang] ?? p.starter[lang]);
    setResult(null);
    if (lang === "py") warmPython();
  }, [lang, p.id, p.starter]);

  function onCode(v: string) {
    setCode(v);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => updateProblem(p.id, (s) => ({ ...s, code: { ...s.code, [lang]: v } })), 400);
  }

  async function execute(kind: "run" | "submit") {
    const cases = buildCases(p, kind, lang);
    setRunning({ label: lang === "py" ? "Starting Python…" : "Running…" });
    setTab("code");
    const outcome = await runCases(lang, code, p.fn[lang], cases, (done, phase) =>
      setRunning({ label: phase === "loading" ? "Loading Python (the first run takes a few seconds)…" : `Running ${Math.min(done + 1, cases.length)} of ${cases.length}…` }),
    );
    setRunning(null);
    if (outcome.kind === "compile-error") {
      setResult({ kind, verdicts: [], compileError: outcome.message });
      if (kind === "submit") updateProblem(p.id, (s) => ({ ...s, attempts: s.attempts + 1 }));
      return;
    }
    const verdicts = judge(cases, outcome.cases);
    setResult({ kind, verdicts });
    if (kind === "submit") {
      updateProblem(p.id, (s) => ({ ...s, attempts: s.attempts + 1 }));
      if (verdicts.every((v) => v.pass)) scheduleSolve(p.id);
    }
  }

  const params = (args: unknown[]) => args.map((a, i) => `${p.params[i]} = ${preview(a, 120)}`).join(", ");
  const remaining = Math.max(0, deadline - now);

  return (
    <div className="bench">
      <header className="bench-head">
        <Link href={from} className="icon-btn" aria-label="Back"><ChevronLeft size={20} /></Link>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {reveal ? `${p.n}. ${p.title}` : "Mixed practice · which pattern is this?"}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "var(--ink-3)" }}>
            <span className={`chip ${p.level.toLowerCase()}`}>{p.level}</span>
            {reveal && <span>{p.shape}</span>}
            {solved && <span className="chip easy"><Check size={11} /> Solved</span>}
          </div>
        </div>
        {mode === "timed" && (
          <span className="chip" style={{ height: 28, fontSize: 13, color: remaining < 120_000 ? "var(--fail)" : "var(--ink-2)" }} role="timer" aria-label="Time left">
            <Timer size={14} /> {timeUp ? "Time's up" : `${Math.floor(remaining / 60000)}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0")}`}
          </span>
        )}
        {next && result?.kind === "submit" && result.verdicts.every((v) => v.pass) && <Link href={next} className="btn small primary">Next problem</Link>}
      </header>

      <div className="bench-tabs seg" role="group" aria-label="Show" style={{ margin: "8px 14px 0" }}>
        <button aria-pressed={tab === "problem"} onClick={() => setTab("problem")}>Problem</button>
        <button aria-pressed={tab === "code"} onClick={() => setTab("code")}>Code</button>
      </div>

      <div className="bench-body" data-tab={tab}>
        <section className="bench-pane bench-left" aria-label="Problem">
          <div className="statement">
            <MiniMarkdown text={p.statement} />
          </div>
          {p.examples.map((e, i) => (
            <div key={i}>
              <p className="kicker" style={{ margin: "16px 0 4px" }}>Example {i + 1}</p>
              <div className="example">
                Input: {params(e.args)}
                {"\n"}Output: {preview(e.output)}
                {e.note && <span style={{ color: "var(--ink-2)" }}>{"\n"}{e.note}</span>}
              </div>
            </div>
          ))}
          <p className="kicker" style={{ margin: "18px 0 4px" }}>Constraints</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink-2)", lineHeight: 1.8 }}>
            {p.constraints.map((c) => <li key={c}>{c}</li>)}
          </ul>
          {reveal && (
            <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "14px 0 0" }}>
              Same shape as{" "}
              <a href={p.reference.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                {p.reference.label} <ExternalLink size={11} style={{ verticalAlign: -1 }} />
              </a>
              . The wording and tests here are Loop&apos;s own.
            </p>
          )}

          <div style={{ marginTop: 28, display: "grid", gap: 14 }}>
            {helpAllowed ? (
              <>
                <HintLadder problem={p} />
                <Walkthrough problem={p} unlocked={(state?.attempts ?? 0) > 0 || (state?.hintsUsed ?? 0) >= p.hints.length || solved} />
              </>
            ) : (
              <p style={{ color: "var(--ink-3)", fontSize: 13 }}>Timed mode: hints and the walkthrough open when you pass or the time runs out.</p>
            )}
          </div>
        </section>

        <section className="bench-pane bench-right" aria-label="Your solution">
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--rule)", flexWrap: "wrap" }}>
            <div className="seg" role="group" aria-label="Language">
              <button aria-pressed={lang === "js"} onClick={() => prefs.set({ lang: "js" })}>JavaScript</button>
              <button aria-pressed={lang === "py"} onClick={() => prefs.set({ lang: "py" })}>Python</button>
            </div>
            <button className="icon-btn" aria-label="Reset to starter code" title="Reset to starter code" onClick={() => onCode(p.starter[lang])}><RotateCcw size={16} /></button>
            <span style={{ flex: 1 }} />
            <button className="btn small" onClick={() => execute("run")} disabled={!!running}><Play size={14} /> Run</button>
            <button className="btn small primary" onClick={() => execute("submit")} disabled={!!running}><Send size={14} /> Submit</button>
          </div>
          <Editor value={code} lang={lang} onChange={onCode} label={`${lang === "js" ? "JavaScript" : "Python"} solution editor. Press Escape then Tab to leave the editor.`} />
          <div className="bench-status" style={{ padding: "8px 14px", borderBottom: "1px solid var(--rule)", fontSize: 12.5, color: "var(--ink-3)" }} aria-live="polite">
            {running ? running.label : result ? (result.kind === "run" ? "Ran the examples" : "Submitted: examples, edge cases, hidden tests and a scale test") : "Run checks the examples. Submit adds edge cases, hidden tests and a scale test."}
          </div>
          <Results result={result} target={p.scale.target} />
        </section>
      </div>
    </div>
  );
}
