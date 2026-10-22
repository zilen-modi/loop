"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { problems } from "@/content/problems";
import { books } from "@/content/syllabus";
import { problemsProgress } from "@/lib/progress";
import { useMounted } from "@/lib/use-mounted";

const chapterTitle = (slug: string) => books.flatMap((b) => b.parts.flatMap((p) => p.chapters)).find((c) => c.slug === slug)?.title ?? slug;

export default function ProblemList() {
  const progress = problemsProgress.use();
  const mounted = useMounted();
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("All");
  const [status, setStatus] = useState("All");
  const [round, setRound] = useState("All");
  const search = useSearchParams();
  const chapters = useMemo(() => ["All", ...new Set(problems.map((p) => chapterTitle(p.chapter)))], []);
  const initialChapter = search.get("chapter");
  const [chapter, setChapter] = useState(initialChapter ? chapterTitle(initialChapter) : "All");

  const rounds = useMemo(() => ["All", ...new Set(problems.flatMap((p) => p.rounds))], []);
  const list = problems.filter((p) => {
    const st = mounted ? progress[p.id]?.status : undefined;
    if (chapter !== "All" && chapterTitle(p.chapter) !== chapter) return false;
    if (level !== "All" && p.level !== level) return false;
    if (round !== "All" && !p.rounds.includes(round)) return false;
    if (status === "Solved" && st !== "solved") return false;
    if (status === "To do" && st === "solved") return false;
    const hay = `${p.title} ${p.shape} ${p.kind === "code" ? p.reference.label : ""}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  const select = (label: string, value: string, set: (v: string) => void, options: string[]) => (
    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-2)" }}>
      {label}
      <select value={value} onChange={(e) => set(e.target.value)} style={{ height: 32, borderRadius: 8, border: "1px solid var(--rule-2)", background: "var(--page)", color: "var(--ink)", padding: "0 8px", font: "13px var(--sans)" }}>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, height: 36, padding: "0 10px", border: "1px solid var(--rule-2)", borderRadius: 8, flex: "1 1 220px" }}>
          <Search size={15} color="var(--ink-3)" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title, pattern or LeetCode number" aria-label="Search problems" style={{ border: 0, outline: "none", background: "transparent", color: "var(--ink)", font: "14px var(--sans)", flex: 1 }} />
        </label>
        {select("Pattern", chapter, setChapter, chapters)}
        {select("Level", level, setLevel, ["All", "Easy", "Medium", "Hard"])}
        {select("Round", round, setRound, rounds)}
        {select("Status", status, setStatus, ["All", "To do", "Solved"])}
      </div>
      <div className="card">
        {list.map((p, i) => {
          const st = mounted ? progress[p.id] : undefined;
          return (
            <Link key={p.id} href={`/problems/${p.id}`} style={{ display: "grid", gridTemplateColumns: "28px minmax(0, 1fr) auto", gap: 12, alignItems: "center", padding: "12px 16px", borderTop: i ? "1px solid var(--rule)" : undefined, textDecoration: "none" }}>
              <span aria-hidden="true" style={{ color: st?.status === "solved" ? "var(--pass)" : "var(--ink-3)", fontSize: 13, textAlign: "center" }}>
                {st?.status === "solved" ? <Check size={16} /> : p.kind === "bug-hunt" ? "★" : p.n}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 500 }}>{p.title}</span>
                <span style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12.5, color: "var(--ink-3)", marginTop: 2 }}>
                  <span>{chapterTitle(p.chapter)}</span>
                  <span>· {p.shape}</span>
                  {p.kind === "code" && <span>· {p.reference.label}</span>}
                  {p.kind === "build" && <span>· {p.minutes}-minute build</span>}
                  {p.kind === "design" && <span>· design lab</span>}
                </span>
              </span>
              <span className={`chip ${p.level.toLowerCase()}`}>{p.level}</span>
            </Link>
          );
        })}
        {!list.length && <p style={{ padding: 16, color: "var(--ink-2)", margin: 0 }}>No problems match those filters.</p>}
      </div>
      <p style={{ color: "var(--ink-3)", fontSize: 13, marginTop: 12 }}>More chapters, and their ladders, are on the way. See the full syllabus in the library.</p>
    </div>
  );
}
