"use client";

import { Check, X } from "lucide-react";
import { checkpoints, correctIndex } from "@/content/checkpoints";
import { reading, updateChapter } from "@/lib/progress";
import { useReader } from "@/components/reader/Reader";

/** A one-question retrieval check. Recalling before reading on is what makes the idea stick. */
export default function Checkpoint({ id }: { id: string }) {
  const { chapterKey } = useReader();
  const c = checkpoints[id];
  const chosen = reading.use()[chapterKey]?.checkpoints?.[id];
  if (!c) return null;
  const right = correctIndex(c);
  const answered = chosen !== undefined;
  const correct = chosen === right;

  return (
    <div className="figure" role="group" aria-labelledby={`cp-${id}`}>
      <p className="fig-label">Quick check</p>
      <p id={`cp-${id}`} style={{ margin: "0 0 10px", fontFamily: "var(--reader-font)", fontSize: "1.02em", lineHeight: 1.55 }}>{c.prompt}</p>
      <div style={{ display: "grid", gap: 6 }}>
        {c.options.map((o, i) => {
          const state = !answered ? "idle" : i === right ? "right" : i === chosen ? "wrong" : "idle";
          return (
            <button
              key={i}
              onClick={() => updateChapter(chapterKey, (s) => ({ ...s, checkpoints: { ...s.checkpoints, [id]: i } }))}
              aria-pressed={chosen === i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                textAlign: "left",
                padding: "8px 12px",
                borderRadius: 8,
                font: "14.5px var(--sans)",
                color: "var(--ink)",
                background: state === "right" ? "var(--pass-soft)" : state === "wrong" ? "var(--fail-soft)" : "transparent",
                border: `1px solid ${state === "right" ? "var(--pass)" : state === "wrong" ? "var(--fail)" : "var(--rule-2)"}`,
              }}
            >
              <span style={{ width: 16 }} aria-hidden="true">
                {state === "right" ? <Check size={15} color="var(--pass)" /> : state === "wrong" ? <X size={15} color="var(--fail)" /> : null}
              </span>
              {o}
            </button>
          );
        })}
      </div>
      <p role="status" style={{ margin: answered ? "10px 0 0" : 0, fontSize: 13.5, color: "var(--ink-2)", lineHeight: 1.55 }}>
        {answered && (
          <>
            <strong style={{ color: correct ? "var(--pass)" : "var(--fail)", fontWeight: 600 }}>{correct ? "Right. " : "Not quite. "}</strong>
            {c.explain}
          </>
        )}
      </p>
    </div>
  );
}
