"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { addCard, reading, updateChapter } from "@/lib/progress";
import { useReader } from "@/components/reader/Reader";

/** Explain it back in one sentence, then compare with a model answer. No AI: you judge your own answer. */
export function ExplainBack({ prompt, model, points }: { prompt: string; model: string; points: string[] }) {
  const { chapterKey } = useReader();
  const saved = reading.use()[chapterKey]?.explain;
  const [text, setText] = useState(saved?.text ?? "");
  const [shown, setShown] = useState(!!saved);
  const [error, setError] = useState("");
  const covered = saved?.covered ?? [];

  function compare() {
    if (text.trim().split(/\s+/).length < 5) {
      setError("Write at least a sentence in your own words first.");
      return;
    }
    setError("");
    setShown(true);
    updateChapter(chapterKey, (c) => ({ ...c, explain: { text: text.trim(), covered: c.explain?.covered ?? [] } }));
  }

  function toggle(i: number) {
    updateChapter(chapterKey, (c) => {
      const cur = c.explain?.covered ?? [];
      const next = cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i];
      return { ...c, explain: { text: c.explain?.text ?? text.trim(), covered: next } };
    });
  }

  return (
    <div className="figure" data-interactive>
      <p className="fig-label">Explain it back</p>
      <label htmlFor="explain" style={{ display: "block", fontFamily: "var(--reader-font)", fontSize: "1em", marginBottom: 8 }}>{prompt}</label>
      <textarea
        id="explain"
        rows={3}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError("");
        }}
        placeholder="In my own words…"
        style={{ width: "100%", font: "14.5px/1.5 var(--sans)", padding: 10, borderRadius: 8, border: `1px solid ${error ? "var(--fail)" : "var(--rule-2)"}`, background: "var(--page)", color: "var(--ink)", resize: "vertical" }}
        aria-invalid={!!error}
        aria-describedby={error ? "explain-err" : undefined}
      />
      {error && <p id="explain-err" style={{ color: "var(--fail)", fontSize: 13, margin: "4px 0 0" }}>{error}</p>}
      {!shown ? (
        <button className="btn small" style={{ marginTop: 8 }} onClick={compare}>Compare with a model answer</button>
      ) : (
        <div style={{ marginTop: 10, fontSize: 14 }}>
          <p style={{ margin: "0 0 8px", fontFamily: "var(--reader-font)", color: "var(--ink-2)", lineHeight: 1.6 }}>
            <strong style={{ color: "var(--ink)", fontWeight: 600 }}>Model answer: </strong>
            {model}
          </p>
          <p className="kicker" style={{ margin: "0 0 4px" }}>Tick what your answer covered</p>
          {points.map((p, i) => (
            <label key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "3px 0", cursor: "pointer" }}>
              <input type="checkbox" checked={covered.includes(i)} onChange={() => toggle(i)} style={{ marginTop: 3 }} />
              <span>{p}</span>
            </label>
          ))}
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-3)" }}>
            {covered.length === points.length ? "You covered every key point." : `${covered.length} of ${points.length} key points. The missing ones are worth a re-read.`}
          </p>
        </div>
      )}
    </div>
  );
}

/** The chapter's recap, which can be added to spaced review in one go. */
export function Recap({ cards }: { cards: { q: string; a: string }[] }) {
  const { chapterKey, chapterTitle } = useReader();
  const added = reading.use()[chapterKey]?.recapAdded;

  function add() {
    cards.forEach((c, i) => addCard({ id: `recap:${chapterKey}:${i}`, source: `${chapterTitle} · recap`, front: c.q, back: c.a }));
    updateChapter(chapterKey, (c) => ({ ...c, recapAdded: true }));
  }

  return (
    <div className="figure" data-interactive>
      <p className="fig-label">Recap cards</p>
      <ol style={{ margin: "0 0 10px", paddingLeft: 18, display: "grid", gap: 8 }}>
        {cards.map((c) => (
          <li key={c.q}>
            <span style={{ fontWeight: 500 }}>{c.q}</span>
            <br />
            <span style={{ color: "var(--ink-2)" }}>{c.a}</span>
          </li>
        ))}
      </ol>
      <button className="btn small" onClick={add} disabled={added}>
        {added ? <><Check size={14} /> Added to review</> : <><Plus size={14} /> Add {cards.length} cards to review</>}
      </button>
    </div>
  );
}
