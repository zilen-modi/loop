"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Timer } from "lucide-react";
import { problemsProgress, updateProblem } from "@/lib/progress";

export const FRAMEWORK = [
  { id: "requirements", label: "Requirements", hint: "What must it do, and how well? Write the 3–4 functional and the key non-functional ones." },
  { id: "estimates", label: "Estimates", hint: "Peak requests per second, storage, the read:write ratio." },
  { id: "api", label: "API", hint: "The few calls clients make, with inputs and outputs." },
  { id: "data", label: "Data model", hint: "What you store, and how you look it up." },
  { id: "design", label: "High-level design", hint: "Boxes and links that meet the requirements. Build it on the canvas." },
  { id: "deep", label: "Deep dive", hint: "The hardest part, one level down: IDs, caching, failure, partitioning." },
  { id: "tradeoffs", label: "Trade-offs", hint: "What each choice costs you, and what you'd do next." },
];

export type InterviewState = { startedAt?: number; done: string[]; notes: Record<string, string> };

const MINUTES = 45;

/** A 45-minute interview clock and the framework as a checklist, with a note per step. */
export default function Interview({ id }: { id: string }) {
  const iv = (problemsProgress.use()[id]?.interview as InterviewState | undefined) ?? { done: [], notes: {} };
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const running = iv.startedAt !== undefined;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);
  const save = (fn: (s: InterviewState) => InterviewState) => updateProblem(id, (st) => ({ ...st, interview: fn((st.interview as InterviewState | undefined) ?? { done: [], notes: {} }) }));
  const left = running ? Math.max(0, iv.startedAt! + MINUTES * 60_000 - now) : MINUTES * 60_000;
  const clock = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}`;

  return (
    <div className="card lab-interview" style={{ marginBottom: 18 }}>
      <button className="lab-interview-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Timer size={16} aria-hidden="true" />
        <span style={{ flex: 1, textAlign: "left" }}>
          <strong>Interview mode</strong>
          <span className="lab-interview-sub">{running ? (left === 0 ? "Time's up: wrap up with trade-offs" : `${clock} left`) : `${MINUTES} minutes, the framework as a checklist`} · {iv.done.length}/{FRAMEWORK.length} steps</span>
        </span>
        <ChevronDown size={16} aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : undefined }} />
      </button>
      {open && (
        <div className="lab-interview-body">
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span className="lab-clock" role="timer" aria-label="Time left" data-testid="interview-clock" style={{ color: running && left < 10 * 60_000 ? "var(--fail)" : "var(--ink)" }}>{clock}</span>
            {!running ? (
              <button className="btn small primary" onClick={() => save((s) => ({ ...s, startedAt: Date.now() }))}>Start the clock</button>
            ) : (
              <button className="btn small" onClick={() => save((s) => ({ ...s, startedAt: undefined }))}>Reset clock</button>
            )}
          </div>
          <ol className="lab-steps">
            {FRAMEWORK.map((f) => {
              const done = iv.done.includes(f.id);
              return (
                <li key={f.id} className={done ? "done" : ""}>
                  <label className="lab-step">
                    <input type="checkbox" checked={done} onChange={() => save((s) => ({ ...s, done: done ? s.done.filter((x) => x !== f.id) : [...s.done, f.id] }))} />
                    <span>
                      <strong>{f.label}</strong>
                      <span className="lab-interview-sub">{f.hint}</span>
                    </span>
                  </label>
                  <textarea
                    aria-label={`Notes: ${f.label}`}
                    placeholder="Notes"
                    rows={2}
                    defaultValue={iv.notes[f.id] ?? ""}
                    onBlur={(e) => save((s) => ({ ...s, notes: { ...s.notes, [f.id]: e.target.value } }))}
                  />
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
