"use client";

import { useState } from "react";
import { Lightbulb, Lock } from "lucide-react";
import type { DesignProblem } from "@/content/problem-types";
import type { DesignScenario } from "@/lib/design/evaluate";
import { problemsProgress, updateProblem } from "@/lib/progress";
import MiniMarkdown from "@/components/ui/MiniMarkdown";

/** The left pane: the brief, the numbers, the decisions and the guidance. */
export default function Brief({
  s,
  p,
  decisions,
  onDecide,
  onLoadReference,
  children,
}: {
  s: DesignScenario;
  p: DesignProblem;
  decisions: Record<string, string>;
  onDecide: (id: string, value: string) => void;
  onLoadReference: () => void;
  children?: React.ReactNode;
}) {
  const state = problemsProgress.use()[p.id];
  return (
    <>
      {children}
      <div className="statement"><MiniMarkdown text={s.statement} /></div>

      <p className="kicker" style={{ margin: "18px 0 6px" }}>Must do</p>
      <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.65, fontSize: 14.5 }}>{s.functional.map((r) => <li key={r}>{r}</li>)}</ul>
      <p className="kicker" style={{ margin: "16px 0 6px" }}>Must be</p>
      <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.65, fontSize: 14.5 }}>{s.nonFunctional.map((r) => <li key={r}>{r}</li>)}</ul>

      <p className="kicker" style={{ margin: "20px 0 6px" }}>The numbers</p>
      <div className="card" style={{ overflow: "hidden" }}>
        {s.estimates.map((e, i) => (
          <div key={e.label} style={{ padding: "8px 12px", borderTop: i ? "1px solid var(--rule)" : undefined, fontSize: 13.5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <strong style={{ fontWeight: 600 }}>{e.label}</strong>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{e.value}</span>
            </div>
            <div style={{ color: "var(--ink-2)", marginTop: 2 }}>{e.how}</div>
          </div>
        ))}
      </div>

      <p className="kicker" style={{ margin: "22px 0 6px" }}>Decisions</p>
      <div style={{ display: "grid", gap: 12 }}>
        {s.decisions.map((d) => {
          const chosen = d.options.find((o) => o.value === decisions[d.id]);
          return (
            <fieldset key={d.id} className="card" style={{ padding: "12px 14px", margin: 0 }}>
              <legend style={{ fontWeight: 600, fontSize: 14, padding: "0 4px" }}>{d.question}</legend>
              {d.options.map((o) => (
                <label key={o.value} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "4px 0", fontSize: 14, lineHeight: 1.45, cursor: "pointer" }}>
                  <input type="radio" name={d.id} value={o.value} checked={decisions[d.id] === o.value} onChange={() => onDecide(d.id, o.value)} style={{ marginTop: 3 }} />
                  {o.label}
                </label>
              ))}
              {chosen && <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--ink-2)", fontFamily: "var(--serif)", lineHeight: 1.55 }}>{chosen.consequence}</p>}
            </fieldset>
          );
        })}
      </div>

      <Guidance s={s} p={p} unlocked={(state?.attempts ?? 0) > 0} onLoad={onLoadReference} />
    </>
  );
}

function Guidance({ s, p, unlocked, onLoad }: { s: DesignScenario; p: DesignProblem; unlocked: boolean; onLoad: () => void }) {
  const state = problemsProgress.use()[p.id];
  const used = state?.hintsUsed ?? 0;
  const [open, setOpen] = useState(false);
  const labels = ["Nudge", "Approach", "Plan"];
  const canOpen = unlocked || used >= s.hints.length;
  return (
    <div style={{ marginTop: 26, display: "grid", gap: 14 }}>
      <div className="card" style={{ padding: "14px 16px" }}>
        <p className="kicker" style={{ margin: "0 0 8px", display: "flex", gap: 6, alignItems: "center" }}><Lightbulb size={13} /> Hints · {used} of {s.hints.length}</p>
        {s.hints.slice(0, used).map((h, i) => (
          <p key={i} style={{ margin: "0 0 10px", fontFamily: "var(--serif)", fontSize: 15.5, lineHeight: 1.6 }}>
            <span className="kicker" style={{ display: "block", marginBottom: 2 }}>{labels[i]}</span>
            {h}
          </p>
        ))}
        {used < s.hints.length && (
          <button className="btn small" onClick={() => updateProblem(p.id, (st) => ({ ...st, hintsUsed: Math.max(st.hintsUsed, used + 1) }))}>Show {labels[used].toLowerCase()}</button>
        )}
      </div>

      {!canOpen ? (
        <div className="card" style={{ padding: "14px 16px", color: "var(--ink-3)", display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}>
          <Lock size={14} /> The reference design opens after you simulate once or use all the hints.
        </div>
      ) : !open ? (
        <button className="btn" onClick={() => { setOpen(true); updateProblem(p.id, (st) => ({ ...st, walkthroughSeen: true })); }}>Open the reference design</button>
      ) : (
        <div className="card" style={{ padding: "16px 18px" }}>
          <p className="kicker" style={{ margin: "0 0 8px" }}>Reference design</p>
          <p style={{ fontFamily: "var(--serif)", fontSize: 15.5, lineHeight: 1.65, margin: "0 0 12px" }}>{s.walkthrough.summary}</p>
          <ol style={{ margin: "0 0 12px", paddingLeft: 20, fontSize: 14, lineHeight: 1.6 }}>{s.walkthrough.steps.map((x) => <li key={x} style={{ marginBottom: 4 }}>{x}</li>)}</ol>
          <button className="btn small" onClick={onLoad}>Load it onto the canvas</button>
          <p className="kicker" style={{ margin: "14px 0 4px" }}>Trade-offs to mention</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>{s.walkthrough.tradeoffs.map((x) => <li key={x}>{x}</li>)}</ul>
          <p className="kicker" style={{ margin: "14px 0 4px" }}>Follow-ups interviewers ask</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>{s.walkthrough.followUps.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
