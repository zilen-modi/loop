"use client";

import { Check, Clock, X } from "lucide-react";
import type { Verdict } from "@/lib/tests";

/** Test report: a one-line summary, then every case, with the first failure expanded. */
export default function Results({ result, target }: { result: null | { kind: "run" | "submit"; verdicts: Verdict[]; compileError?: string }; target: string }) {
  if (!result) return <div className="results" />;
  if (result.compileError)
    return (
      <div className="results">
        <p style={{ color: "var(--fail)", fontWeight: 600, margin: "4px 0 8px" }}>Your code didn&apos;t run</p>
        <pre className="example" style={{ color: "var(--fail)" }}>{result.compileError}</pre>
      </div>
    );

  const v = result.verdicts;
  const failed = v.find((x) => !x.pass);
  const passed = v.filter((x) => x.pass).length;
  const totalMs = v.reduce((n, x) => n + (x.ms ?? 0), 0);
  const scale = v.find((x) => x.group === "scale");

  let summary: React.ReactNode;
  if (!failed) summary = <span style={{ color: "var(--pass)" }}>{result.kind === "submit" ? `Accepted: all ${v.length} tests passed` : `All ${v.length} examples passed`} · {Math.round(totalMs)} ms</span>;
  else if ((failed.status === "slow" || failed.status === "timeout") && failed.group === "scale")
    summary = <span style={{ color: "var(--warn)" }}>Correct on {passed} tests, but too slow on the scale test. Aim for {target}.</span>;
  else if (failed.status === "timeout")
    summary = <span style={{ color: "var(--fail)" }}>Time limit exceeded on {failed.label}. Check for a loop that never ends.</span>;
  else summary = <span style={{ color: "var(--fail)" }}>{failed.status === "error" ? "Error" : "Wrong answer"} on {failed.label} · {passed} of {v.length} passed</span>;

  return (
    <div className="results">
      <p style={{ fontWeight: 600, margin: "4px 0 8px" }} role="status">{summary}</p>
      {result.kind === "submit" && !failed && scale && <p style={{ margin: "0 0 8px", color: "var(--ink-2)" }}>Scale test: {scale.args} in {Math.round(scale.ms ?? 0)} ms.</p>}
      {result.kind === "submit" && !failed && <p style={{ margin: "0 0 8px", color: "var(--ink-2)" }}>Scheduled for a re-solve, so it sticks. Open the walkthrough to compare approaches.</p>}
      {[...v.filter((x) => !x.pass && x.status !== "skipped"), ...v.filter((x) => x.pass || x.status === "skipped")].map((x, i) => {
        const open = x === failed || result.kind === "run";
        return (
          <div key={i} className="result-row">
            <span aria-hidden="true">
              {x.pass ? <Check size={15} color="var(--pass)" /> : x.status === "slow" || x.status === "timeout" ? <Clock size={15} color="var(--warn)" /> : x.status === "skipped" ? <span style={{ color: "var(--ink-3)" }}>·</span> : <X size={15} color="var(--fail)" />}
            </span>
            <span>{x.label}{x.status === "skipped" ? " (not run)" : ""}</span>
            <span style={{ color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>{x.ms !== undefined ? `${x.ms < 1 ? "<1" : Math.round(x.ms)} ms` : ""}</span>
            {open && x.status !== "skipped" && (
              <div className="detail">
                {x.group === "scale" ? `Input: ${x.args}` : `Input: ${x.args}`}
                {"\n"}Expected: {x.expected}
                {x.got !== undefined && `\nYour output: ${x.got}`}
                {x.detail && `\n${x.detail}`}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
