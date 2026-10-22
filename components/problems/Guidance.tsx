"use client";

import { useState } from "react";
import { Lightbulb, Lock, BookOpen } from "lucide-react";
import type { CodeProblem, Lang } from "@/content/problem-types";
import { problemsProgress, updateProblem } from "@/lib/progress";

/** Hints come one at a time: a nudge, then the approach, then pseudocode. */
export function HintLadder({ problem: p }: { problem: CodeProblem }) {
  const used = problemsProgress.use()[p.id]?.hintsUsed ?? 0;
  const labels = ["Nudge", "Approach", "Pseudocode"];
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <p className="kicker" style={{ margin: "0 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
        <Lightbulb size={13} /> Hints · {used} of {p.hints.length}
      </p>
      {p.hints.slice(0, used).map((h, i) => (
        <p key={i} style={{ margin: "0 0 10px", fontFamily: i === 2 ? "var(--mono)" : "var(--serif)", fontSize: i === 2 ? 13 : 15.5, lineHeight: 1.6 }}>
          <span className="kicker" style={{ display: "block", marginBottom: 2 }}>{labels[i]}</span>
          {h}
        </p>
      ))}
      {used < p.hints.length && (
        <button className="btn small" onClick={() => updateProblem(p.id, (s) => ({ ...s, hintsUsed: Math.max(s.hintsUsed, used + 1) }))}>
          Show {labels[used].toLowerCase()}
        </button>
      )}
    </div>
  );
}

/** The full walkthrough unlocks after an honest attempt (a Submit) or all hints. */
export function Walkthrough({ problem: p, unlocked }: { problem: CodeProblem; unlocked: boolean }) {
  const seen = problemsProgress.use()[p.id]?.walkthroughSeen;
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<Lang>("js");
  const w = p.walkthrough;

  if (!unlocked)
    return (
      <div className="card" style={{ padding: "14px 16px", color: "var(--ink-3)", display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}>
        <Lock size={14} /> The walkthrough opens after you submit once or use all the hints.
      </div>
    );

  if (!open && !seen)
    return (
      <button
        className="btn"
        onClick={() => {
          setOpen(true);
          updateProblem(p.id, (s) => ({ ...s, walkthroughSeen: true }));
        }}
      >
        <BookOpen size={15} /> Open the walkthrough
      </button>
    );

  return (
    <div className="card" style={{ padding: "16px 18px" }}>
      <p className="kicker" style={{ margin: "0 0 8px" }}>Walkthrough</p>
      <p style={{ fontFamily: "var(--serif)", fontSize: 15.5, lineHeight: 1.65, margin: "0 0 10px" }}>{w.idea}</p>
      <p style={{ margin: "0 0 12px", fontSize: 14 }}>
        <strong style={{ fontWeight: 600 }}>Complexity: </strong>
        {w.complexity}
      </p>
      <div className="seg" role="group" aria-label="Solution language" style={{ marginBottom: 8 }}>
        <button aria-pressed={lang === "js"} onClick={() => setLang("js")}>JavaScript</button>
        <button aria-pressed={lang === "py"} onClick={() => setLang("py")}>Python</button>
      </div>
      <pre className="example" style={{ whiteSpace: "pre", overflowX: "auto" }}>{p.solution[lang]}</pre>
      <p className="kicker" style={{ margin: "14px 0 4px" }}>Common bugs</p>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
        {w.pitfalls.map((x) => <li key={x}>{x}</li>)}
      </ul>
      <p className="kicker" style={{ margin: "14px 0 4px" }}>Follow-ups interviewers ask</p>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.6 }}>
        {w.followUps.map((x) => <li key={x}>{x}</li>)}
      </ul>
    </div>
  );
}
