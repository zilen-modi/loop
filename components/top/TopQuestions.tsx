"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ExternalLink, Lock } from "lucide-react";
import { dsaPatterns, dsaQuestions, dsaSources, patternChapter } from "@/content/top/dsa";
import { behavioralQuestions, hldQuestions, lldQuestions, type DesignQuestion } from "@/content/top/design";
import { problemByLeetCode } from "@/content/problems";
import { createLocalStore } from "@/lib/local-store";
import { useMounted } from "@/lib/use-mounted";

type TopState = { done: Record<string, number>; notes: Record<string, string> };
const top = createLocalStore<TopState>("loop:top", { done: {}, notes: {} });

const toggle = (id: string) =>
  top.set((s) => {
    const done = { ...s.done };
    if (done[id]) delete done[id];
    else done[id] = Date.now();
    return { ...s, done };
  });

type Tab = "dsa" | "lld" | "hld" | "behavioral";
const TABS: { id: Tab; label: string }[] = [
  { id: "dsa", label: "Coding" },
  { id: "lld", label: "Low-level design" },
  { id: "hld", label: "System design" },
  { id: "behavioral", label: "Behavioral" },
];

export default function TopQuestions() {
  const [tab, setTab] = useState<Tab>("dsa");
  const mounted = useMounted();
  const state = top.use();
  const done = mounted ? state.done : {};

  const counts: Record<Tab, [number, number]> = {
    dsa: [dsaQuestions.filter((q) => done[q.slug]).length, dsaQuestions.length],
    lld: [lldQuestions.filter((q) => done[q.id]).length, lldQuestions.length],
    hld: [hldQuestions.filter((q) => done[q.id]).length, hldQuestions.length],
    behavioral: [behavioralQuestions.filter((q) => done[q.id]).length, behavioralQuestions.length],
  };

  return (
    <div>
      <div className="seg" role="group" aria-label="Question type" style={{ flexWrap: "wrap", marginBottom: 18 }}>
        {TABS.map((t) => (
          <button key={t.id} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label} <span style={{ color: "var(--ink-3)", marginLeft: 4 }}>{counts[t.id][0]}/{counts[t.id][1]}</span>
          </button>
        ))}
      </div>
      {tab === "dsa" && <Coding done={done} />}
      {tab === "lld" && <DesignList items={lldQuestions} done={done} book="lld" intro="Machine-coding rounds ask you to build one of these, working and tested, in 60 to 120 minutes. Frontend rounds use the last group." />}
      {tab === "hld" && <DesignList items={hldQuestions} done={done} book="hld" intro="System-design rounds usually pick one of these. Tick a question once you can walk through it end to end, including trade-offs." />}
      {tab === "behavioral" && <Behavioral done={done} notes={mounted ? state.notes : {}} />}
    </div>
  );
}

function Progress({ value, total }: { value: number; total: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--ink-3)" }}>
      <span style={{ width: 64, height: 4, borderRadius: 2, background: "var(--rule)", overflow: "hidden" }}>
        <span style={{ display: "block", height: "100%", width: `${total ? (value / total) * 100 : 0}%`, background: "var(--pass)" }} />
      </span>
      {value}/{total}
    </span>
  );
}

function Check({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="tick">
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={label} style={{ width: 17, height: 17, accentColor: "var(--pass)", flexShrink: 0 }} />
    </label>
  );
}

function Coding({ done }: { done: Record<string, number> }) {
  const [classicOnly, setClassicOnly] = useState(false);
  const [hidePremium, setHidePremium] = useState(false);
  const [level, setLevel] = useState("All");
  const [status, setStatus] = useState("All");

  const shown = dsaQuestions.filter(
    (q) =>
      (!classicOnly || q.classic) &&
      (!hidePremium || !q.premium) &&
      (level === "All" || q.difficulty === level) &&
      (status === "All" || (status === "Solved" ? !!done[q.slug] : !done[q.slug])),
  );

  return (
    <div>
      <p style={{ color: "var(--ink-2)", margin: "0 0 14px", lineHeight: 1.6, maxWidth: 760 }}>
        The {dsaQuestions.filter((q) => q.classic).length} classic questions most candidates practise, plus {dsaQuestions.filter((q) => !q.classic).length} that are commonly added to them, grouped by pattern. Solve them on LeetCode and tick them off here. Where Loop has its own version with hints and a walkthrough, there&apos;s a link.
      </p>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 16, fontSize: 13, color: "var(--ink-2)" }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={classicOnly} onChange={(e) => setClassicOnly(e.target.checked)} /> Classic 75 only</label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={hidePremium} onChange={(e) => setHidePremium(e.target.checked)} /> Hide premium</label>
        <Select label="Level" value={level} set={setLevel} options={["All", "Easy", "Medium", "Hard"]} />
        <Select label="Status" value={status} set={setStatus} options={["All", "To do", "Solved"]} />
        <span style={{ marginLeft: "auto" }}>{shown.length} shown</span>
      </div>
      <div style={{ display: "grid", gap: 14 }}>
        {dsaPatterns.map((pattern) => {
          const all = dsaQuestions.filter((q) => q.pattern === pattern);
          const list = shown.filter((q) => q.pattern === pattern);
          if (!list.length) return null;
          return (
            <section key={pattern} className="card" aria-label={pattern}>
              <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--rule)", flexWrap: "wrap" }}>
                <h2 style={{ fontFamily: "var(--serif)", fontWeight: 500, fontSize: 18, margin: 0, flex: 1 }}>{pattern}</h2>
                <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Loop chapter {patternChapter[pattern]}</span>
                <Progress value={all.filter((q) => done[q.slug]).length} total={all.length} />
              </header>
              {list.map((q, i) => {
                const loop = problemByLeetCode(q.id);
                return (
                  <div key={q.slug} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 16px", borderTop: i ? "1px solid var(--rule)" : undefined, flexWrap: "wrap" }}>
                    <Check checked={!!done[q.slug]} onChange={() => toggle(q.slug)} label={`Mark ${q.title} solved`} />
                    <a href={`https://leetcode.com/problems/${q.slug}/`} target="_blank" rel="noopener noreferrer" style={{ flex: "1 1 240px", textDecoration: "none", minWidth: 0, minHeight: 40, display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0 4px", color: done[q.slug] ? "var(--ink-3)" : "var(--ink)" }}>
                      <span style={{ color: "var(--ink-3)", fontVariantNumeric: "tabular-nums", marginRight: 4 }}>{q.id}.</span>
                      <span>{q.title} <ExternalLink size={11} color="var(--ink-3)" /></span>
                    </a>
                    {!q.classic && <span className="chip">Addition</span>}
                    {q.premium && <span className="chip" title="Needs LeetCode Premium"><Lock size={10} /> Premium</span>}
                    {loop && <Link className="chip new" href={`/problems/${loop.id}?from=${encodeURIComponent("/top")}`} style={{ textDecoration: "none" }}>Practise in Loop</Link>}
                    <span className={`chip ${q.difficulty.toLowerCase()}`}>{q.difficulty}</span>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
      <p style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 14 }}>
        Based on the classic list from{" "}
        <a href={dsaSources.list.href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>{dsaSources.list.label}</a>
        . Numbers, titles, difficulty and premium status fetched from LeetCode on {dsaSources.fetched}.
      </p>
    </div>
  );
}

function DesignList({ items, done, book, intro }: { items: DesignQuestion[]; done: Record<string, number>; book: "lld" | "hld"; intro: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const groups = [...new Set(items.map((q) => q.tag ?? "Core"))];
  return (
    <div>
      <p style={{ color: "var(--ink-2)", margin: "0 0 14px", lineHeight: 1.6, maxWidth: 760 }}>{intro}</p>
      <div style={{ display: "grid", gap: 14 }}>
        {groups.map((g) => {
          const list = items.filter((q) => (q.tag ?? "Core") === g);
          return (
            <section key={g} className="card" aria-label={g}>
              <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--rule)" }}>
                <h2 style={{ fontFamily: "var(--serif)", fontWeight: 500, fontSize: 18, margin: 0, flex: 1 }}>{g === "Core" ? (book === "lld" ? "Backend and object design" : "Classic designs") : g}</h2>
                <Progress value={list.filter((q) => done[q.id]).length} total={list.length} />
              </header>
              {list.map((q, i) => {
                const isOpen = open === q.id;
                return (
                  <div key={q.id} style={{ borderTop: i ? "1px solid var(--rule)" : undefined }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px" }}>
                      <Check checked={!!done[q.id]} onChange={() => toggle(q.id)} label={`Mark ${q.title} practised`} />
                      <button onClick={() => setOpen(isOpen ? null : q.id)} aria-expanded={isOpen} style={{ all: "unset", cursor: "pointer", flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 500, color: done[q.id] ? "var(--ink-3)" : "var(--ink)" }}>{q.title}</span>
                        <span style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginTop: 2 }}>{q.tests}</span>
                      </button>
                      <ChevronDown size={16} color="var(--ink-3)" style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} aria-hidden="true" />
                    </div>
                    {isOpen && (
                      <div style={{ padding: "0 16px 14px 45px", fontSize: 14 }}>
                        <p className="kicker" style={{ margin: "0 0 6px" }}>What a strong answer covers</p>
                        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>{q.cover.map((c) => <li key={c}>{c}</li>)}</ul>
                        <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--ink-3)" }}>
                          Taught in {book === "lld" ? "Low-level design" : "High-level design"}, chapter {q.chapter} (coming soon).
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Behavioral({ done, notes }: { done: Record<string, number>; notes: Record<string, string> }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div>
      <p style={{ color: "var(--ink-2)", margin: "0 0 14px", lineHeight: 1.6, maxWidth: 760 }}>
        Most behavioral rounds draw from these. Build a story bank: for each question, jot down a real situation in STAR form (situation, task, action, result). Notes stay in this browser only.
      </p>
      <div className="card">
        {behavioralQuestions.map((q, i) => {
          const isOpen = open === q.id;
          return (
            <div key={q.id} style={{ borderTop: i ? "1px solid var(--rule)" : undefined }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px" }}>
                <Check checked={!!done[q.id]} onChange={() => toggle(q.id)} label={`Mark story ready for: ${q.question}`} />
                <button onClick={() => setOpen(isOpen ? null : q.id)} aria-expanded={isOpen} style={{ all: "unset", cursor: "pointer", flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: "var(--serif)", fontSize: 16, color: done[q.id] ? "var(--ink-3)" : "var(--ink)" }}>{q.question}</span>
                  <span style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginTop: 2 }}>Assesses: {q.assesses}</span>
                </button>
                {notes[q.id] && <span className="chip easy">Story saved</span>}
                <ChevronDown size={16} color="var(--ink-3)" style={{ transform: isOpen ? "rotate(180deg)" : "none" }} aria-hidden="true" />
              </div>
              {isOpen && (
                <div style={{ padding: "0 16px 14px 45px" }}>
                  <p style={{ margin: "0 0 8px", fontSize: 14, color: "var(--ink-2)" }}><strong style={{ color: "var(--ink)", fontWeight: 600 }}>Tip: </strong>{q.tip}</p>
                  <label htmlFor={`story-${q.id}`} className="kicker">Your story (STAR)</label>
                  <textarea
                    id={`story-${q.id}`}
                    rows={5}
                    defaultValue={notes[q.id] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      top.set((s) => ({ ...s, notes: { ...s.notes, [q.id]: v } }));
                    }}
                    placeholder={"Situation:\nTask:\nAction:\nResult:"}
                    style={{ width: "100%", marginTop: 6, font: "14px/1.55 var(--sans)", padding: 10, borderRadius: 8, border: "1px solid var(--rule-2)", background: "var(--page)", color: "var(--ink)", resize: "vertical" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Select({ label, value, set, options }: { label: string; value: string; set: (v: string) => void; options: string[] }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {label}
      <select value={value} onChange={(e) => set(e.target.value)} style={{ height: 30, borderRadius: 7, border: "1px solid var(--rule-2)", background: "var(--page)", color: "var(--ink)", padding: "0 8px", font: "13px var(--sans)" }}>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}
