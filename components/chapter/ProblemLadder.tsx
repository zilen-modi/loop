"use client";

import Link from "next/link";
import { Check, ChevronRight, Repeat } from "lucide-react";
import { problemsForChapter } from "@/content/problems";
import { problemsProgress } from "@/lib/progress";
import { useReader } from "@/components/reader/Reader";

/** The chapter's problems, easy to hard. Each row opens the workbench. */
export default function ProblemLadder({ chapter }: { chapter: string }) {
  const { chapterKey } = useReader();
  const progress = problemsProgress.use();
  const list = problemsForChapter(chapter);
  const now = Date.now();

  return (
    <div className="figure" style={{ breakInside: "auto", padding: "6px 0" }} data-interactive>
      {list.map((p) => {
        const st = progress[p.id];
        const due = st?.due && st.due <= now;
        return (
          <Link
            key={p.id}
            href={`/problems/${p.id}?from=${encodeURIComponent(`/learn/${chapterKey}`)}`}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", textDecoration: "none", borderTop: p.n > 1 ? "1px solid var(--rule)" : undefined, breakInside: "avoid" }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                fontFamily: "var(--sans)",
                fontSize: 12,
                background: st?.status === "solved" ? "var(--pass-soft)" : "var(--page-2)",
                color: st?.status === "solved" ? "var(--pass)" : "var(--ink-2)",
              }}
            >
              {st?.status === "solved" ? <Check size={14} /> : p.kind === "bug-hunt" ? "★" : p.n}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontFamily: "var(--sans)", fontSize: 14.5, fontWeight: 500, color: "var(--ink)" }}>{p.title}</span>
              <span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 3, alignItems: "center", fontFamily: "var(--sans)", fontSize: 12, color: "var(--ink-3)" }}>
                <span className={`chip ${p.level.toLowerCase()}`}>{p.level}</span>
                <span>{p.shape}</span>
                {p.kind === "code" && <span>· {p.reference.label}</span>}
                {due && (
                  <span className="chip new">
                    <Repeat size={11} /> Re-solve due
                  </span>
                )}
              </span>
            </span>
            <ChevronRight size={16} color="var(--ink-3)" aria-hidden="true" />
            <span className="sr-only">{st?.status === "solved" ? "Solved" : st ? "Attempted" : "Not started"}</span>
          </Link>
        );
      })}
    </div>
  );
}
