"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, ChevronLeft, X } from "lucide-react";
import { compile, deepEqual, mulberry32, preview, type BugHuntProblem, type CodeProblem } from "@/content/problem-types";
import { problemsProgress, scheduleSolve, updateProblem } from "@/lib/progress";
import MiniMarkdown from "@/components/ui/MiniMarkdown";

/** Code review: click the buggy line, say why, then see the bug on real inputs. */
export default function BugHunt({ problem: p, reference, from }: { problem: BugHuntProblem; reference: CodeProblem; from: string }) {
  const state = problemsProgress.use()[p.id];
  const [line, setLine] = useState<number | null>(null);
  const [reason, setReason] = useState<number | null>(null);
  const [checked, setChecked] = useState<null | { line: boolean; reason: boolean }>(null);
  const [error, setError] = useState("");
  const solved = state?.status === "solved";
  const done = checked?.line && checked.reason;

  // Show the reasons in a stable shuffled order, so the right one isn't always first.
  const order = useMemo(() => {
    const rand = mulberry32([...p.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7));
    const idx = p.reasons.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx;
  }, [p.id, p.reasons]);

  const probes = useMemo(() => {
    const buggy = compile(p.lines.join("\n"), p.fnName);
    const ref = compile(reference.solution.js, reference.fn.js);
    return p.probeCases.map((args) => {
      const got = buggy(...structuredClone(args));
      const expected = ref(...structuredClone(args));
      return { args: args.map((a, i) => `${reference.params[i]} = ${preview(a)}`).join(", "), got: preview(got), expected: preview(expected), ok: deepEqual(got, expected) };
    });
  }, [p, reference]);

  function check() {
    if (line === null || reason === null) {
      setError(line === null ? "Click the line you think is wrong first." : "Choose why it's wrong.");
      return;
    }
    setError("");
    const result = { line: line === p.bugLine, reason: reason === p.reasonIndex };
    setChecked(result);
    updateProblem(p.id, (s) => ({ ...s, attempts: s.attempts + 1 }));
    if (result.line && result.reason) scheduleSolve(p.id);
  }

  return (
    <div className="bench">
      <header className="bench-head">
        <Link href={from} className="icon-btn" aria-label="Back"><ChevronLeft size={20} /></Link>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 500 }}>★ {p.title}</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "var(--ink-3)" }}>
            <span className={`chip ${p.level.toLowerCase()}`}>{p.level}</span>
            <span>{p.shape}</span>
            {solved && <span className="chip easy"><Check size={11} /> Solved</span>}
          </div>
        </div>
      </header>
      <div className="bench-body bug">
        <section className="bench-pane bench-left">
          <div className="statement"><MiniMarkdown text={p.statement} /></div>
          <p className="kicker" style={{ margin: "18px 0 6px" }}>Why is it wrong?</p>
          <div role="radiogroup" aria-label="Reason" style={{ display: "grid", gap: 6 }}>
            {order.map((i) => p.reasons[i]).map((r, pos) => { const i = order[pos]; return (
              <label key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 10px", borderRadius: 8, border: `1px solid ${reason === i ? "var(--ink-3)" : "var(--rule)"}`, cursor: "pointer", fontSize: 14, lineHeight: 1.5 }}>
                <input type="radio" name="reason" checked={reason === i} onChange={() => { setReason(i); setChecked(null); setError(""); }} style={{ marginTop: 3 }} />
                {r}
              </label>
            ); })}
          </div>
          <button className="btn primary" style={{ marginTop: 12 }} onClick={check}>Check my review</button>
          {error && <p style={{ color: "var(--fail)", fontSize: 13, margin: "6px 0 0" }} role="alert">{error}</p>}
          {checked && (
            <div role="status" style={{ marginTop: 14, fontSize: 14, lineHeight: 1.6 }}>
              {done ? (
                <>
                  <p style={{ color: "var(--pass)", fontWeight: 600, margin: "0 0 6px" }}>Right line, right reason.</p>
                  <p style={{ fontFamily: "var(--serif)", fontSize: 15.5, margin: 0 }}>{p.explanation}</p>
                </>
              ) : (
                <p style={{ color: "var(--fail)", margin: 0 }}>
                  {!checked.line && "That line is fine. "}
                  {checked.line && !checked.reason && "Right line, but not the right reason. "}
                  Look at the probe results on the right for a clue, then try again.
                </p>
              )}
            </div>
          )}
        </section>
        <section className="bench-pane bug-code" style={{ padding: "16px 0" }} aria-label="Code under review">
          <p className="kicker" style={{ margin: "0 18px 8px" }}>Click the line with the bug</p>
          <ol className="bug-lines" style={{ listStyle: "none", margin: 0, padding: 0, fontFamily: "var(--mono)", fontSize: 13.5, overflowX: "auto" }}>
            {p.lines.map((l, i) => {
              const picked = line === i;
              const verdict = checked && picked ? (checked.line ? "var(--pass-soft)" : "var(--fail-soft)") : picked ? "var(--hl)" : "transparent";
              return (
                <li key={i}>
                  <button
                    onClick={() => { setLine(i); setChecked(null); setError(""); }}
                    aria-pressed={picked}
                    className="bug-line"
                    aria-label={`Line ${i + 1}: ${l.trim() || "blank"}`}
                    style={{ all: "unset", cursor: "pointer", display: "grid", gridTemplateColumns: "44px 1fr", width: "max-content", minWidth: "100%", boxSizing: "border-box", paddingRight: 16, background: verdict, whiteSpace: "pre" }}
                  >
                    <span style={{ textAlign: "right", paddingRight: 14, color: "var(--ink-3)" }}>{i + 1}</span>
                    <span style={{ padding: "2px 0" }}>{l}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div style={{ margin: "18px 18px 0" }}>
            <p className="kicker" style={{ margin: "0 0 6px" }}>Probe results: her code against the right answers</p>
            {probes.map((x, i) => (
              <div key={i} className="result-row" style={{ fontSize: 13 }}>
                <span aria-hidden="true">{x.ok ? <Check size={15} color="var(--pass)" /> : <X size={15} color="var(--fail)" />}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{x.args}</span>
                <span />
                <div className="detail">Her output: {x.got} · expected: {x.expected}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
