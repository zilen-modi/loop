"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, LayoutList, Search, SlidersHorizontal, Table2 } from "lucide-react";
import type { Problem } from "@/content/problem-types";
import { problems } from "@/content/problems";
import { books } from "@/content/syllabus";
import { problemsProgress } from "@/lib/progress";
import { useMounted } from "@/lib/use-mounted";

const chapterTitle = (slug: string) => books.flatMap((b) => b.parts.flatMap((p) => p.chapters)).find((c) => c.slug === slug)?.title ?? slug;
const bookOf = (slug: string) => books.find((b) => b.parts.some((p) => p.chapters.some((c) => c.slug === slug)));
const BOOK_SHORT: Record<string, string> = { dsa: "DSA", lld: "LLD", hld: "HLD" };
const KIND: Record<Problem["kind"], string> = { code: "Coding", "bug-hunt": "Bug hunt", build: "Build", design: "Design lab" };
const LEVEL_RANK = { Easy: 0, Medium: 1, Hard: 2 };
const VIEW_KEY = "loop:problems-view";
const day = (t?: number) => (t ? new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—");

type SortKey = "order" | "title" | "kind" | "book" | "chapter" | "level" | "status" | "attempts" | "lastSolved" | "due";
const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "order", label: "#", numeric: true },
  { key: "title", label: "Problem" },
  { key: "kind", label: "Type" },
  { key: "book", label: "Book" },
  { key: "chapter", label: "Chapter" },
  { key: "level", label: "Level" },
  { key: "status", label: "Status" },
  { key: "attempts", label: "Attempts", numeric: true },
  { key: "lastSolved", label: "Last solved", numeric: true },
  { key: "due", label: "Re-solve", numeric: true },
];

export default function ProblemList() {
  const progress = problemsProgress.use();
  const mounted = useMounted();
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("All");
  const [status, setStatus] = useState("All");
  const [round, setRound] = useState("All");
  const [kind, setKind] = useState("All");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState<"list" | "table">("list");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "order", dir: 1 });
  useEffect(() => {
    try {
      if (localStorage.getItem(VIEW_KEY) === "table") setView("table");
    } catch {}
  }, []);
  const chooseView = (v: "list" | "table") => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };
  const search = useSearchParams();
  const chapters = useMemo(() => ["All", ...new Set(problems.map((p) => chapterTitle(p.chapter)))], []);
  const initialChapter = search.get("chapter");
  const [chapter, setChapter] = useState(initialChapter ? chapterTitle(initialChapter) : "All");

  const rounds = useMemo(() => ["All", ...new Set(problems.flatMap((p) => p.rounds))], []);
  const list = problems.filter((p) => {
    const st = mounted ? progress[p.id]?.status : undefined;
    if (chapter !== "All" && chapterTitle(p.chapter) !== chapter) return false;
    if (level !== "All" && p.level !== level) return false;
    if (kind !== "All" && KIND[p.kind] !== kind) return false;
    if (round !== "All" && !p.rounds.includes(round)) return false;
    if (status === "Solved" && st !== "solved") return false;
    if (status === "To do" && st === "solved") return false;
    const hay = `${p.title} ${p.shape} ${p.kind === "code" ? p.reference.label : ""}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  const active = [chapter, level, round, status, kind].filter((v) => v !== "All").length;
  const solvedCount = list.filter((p) => mounted && progress[p.id]?.status === "solved").length;

  const now = Date.now();
  const statusOf = (p: Problem) => {
    const st = mounted ? progress[p.id] : undefined;
    if (!st || (!st.attempts && st.status !== "solved")) return { label: "To do", rank: 0 };
    if (st.status === "solved") return st.due && st.due <= now ? { label: "Due", rank: 3 } : { label: "Solved", rank: 2 };
    return { label: "Attempted", rank: 1 };
  };
  const value = (p: Problem, key: SortKey): string | number => {
    const st = mounted ? progress[p.id] : undefined;
    switch (key) {
      case "order": return problems.indexOf(p);
      case "title": return p.title.toLowerCase();
      case "kind": return KIND[p.kind];
      case "book": return books.indexOf(bookOf(p.chapter)!);
      case "chapter": return chapterTitle(p.chapter).toLowerCase();
      case "level": return LEVEL_RANK[p.level];
      case "status": return statusOf(p).rank;
      case "attempts": return st?.attempts ?? 0;
      case "lastSolved": return st?.lastSolved ?? 0;
      case "due": return st?.due ?? Infinity;
    }
  };
  const rows = view === "table" ? [...list].sort((a, b) => {
    const va = value(a, sort.key);
    const vb = value(b, sort.key);
    return (va < vb ? -1 : va > vb ? 1 : problems.indexOf(a) - problems.indexOf(b)) * sort.dir;
  }) : list;
  const sortBy = (key: SortKey) => setSort((s0) => (s0.key === key ? { key, dir: s0.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  const select = (label: string, value: string, set: (v: string) => void, options: string[]) => (
    <label className="filter" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-2)" }}>
      {label}
      <select value={value} onChange={(e) => set(e.target.value)} style={{ maxWidth: 190, height: 32, borderRadius: 8, border: "1px solid var(--rule-2)", background: "var(--page)", color: "var(--ink)", padding: "0 8px", font: "13px var(--sans)" }}>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, height: 40, padding: "0 10px", border: "1px solid var(--rule-2)", borderRadius: 8, flex: "1 1 220px" }}>
          <Search size={15} color="var(--ink-3)" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title, pattern or LeetCode number" aria-label="Search problems" style={{ border: 0, outline: "none", background: "transparent", color: "var(--ink)", font: "14px var(--sans)", flex: 1 }} />
        </label>
        <button className="btn filters-toggle" aria-expanded={filtersOpen} aria-controls="problem-filters" onClick={() => setFiltersOpen(!filtersOpen)}>
          <SlidersHorizontal size={15} aria-hidden="true" /> Filters{active ? ` (${active})` : ""}
        </button>
        <div id="problem-filters" className={`filters${filtersOpen ? " open" : ""}`}>
          {select("Pattern", chapter, setChapter, chapters)}
          {select("Type", kind, setKind, ["All", ...Object.values(KIND)])}
          {select("Level", level, setLevel, ["All", "Easy", "Medium", "Hard"])}
          {select("Round", round, setRound, rounds)}
          {select("Status", status, setStatus, ["All", "To do", "Solved"])}
        </div>
      </div>
      <div className="problems-bar">
        <p role="status" style={{ margin: 0, color: "var(--ink-3)", fontSize: 13 }}>
          {list.length} {list.length === 1 ? "problem" : "problems"}{mounted && solvedCount ? ` · ${solvedCount} solved` : ""}
        </p>
        <div className="seg" role="group" aria-label="View">
          <button aria-pressed={view === "list"} onClick={() => chooseView("list")}><LayoutList size={14} aria-hidden="true" /> List</button>
          <button aria-pressed={view === "table"} onClick={() => chooseView("table")}><Table2 size={14} aria-hidden="true" /> Table</button>
        </div>
      </div>
      {view === "table" ? (
        <div className="problems-table-wrap card">
          <table className="problems-table" data-testid="problems-table">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className={c.key === "title" ? "pin" : c.numeric ? "num" : undefined}>
                    <button onClick={() => sortBy(c.key)}>
                      {c.label}
                      {sort.key === c.key ? (sort.dir === 1 ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />) : null}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const st = mounted ? progress[p.id] : undefined;
                const status = statusOf(p);
                const book = bookOf(p.chapter);
                return (
                  <tr key={p.id} data-id={p.id}>
                    <td className="num">{problems.indexOf(p) + 1}</td>
                    <th scope="row" className="pin">
                      <Link href={`/problems/${p.id}`}>{p.title}</Link>
                    </th>
                    <td>{KIND[p.kind]}</td>
                    <td>{book ? BOOK_SHORT[book.id] : "—"}</td>
                    <td className="wrap">{chapterTitle(p.chapter)}</td>
                    <td><span className={`chip ${p.level.toLowerCase()}`}>{p.level}</span></td>
                    <td><span className={`status-${status.label.toLowerCase().replace(" ", "-")}`}>{status.label === "Solved" && <Check size={12} aria-hidden="true" />} {status.label}</span></td>
                    <td className="num">{st?.attempts ?? 0}</td>
                    <td className="num">{day(st?.lastSolved)}</td>
                    <td className="num">{st?.due ? day(st.due) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!list.length && <p style={{ padding: 16, color: "var(--ink-2)", margin: 0 }}>No problems match those filters.</p>}
        </div>
      ) : (
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
                <span style={{ display: "block", fontSize: 12.5, color: "var(--ink-3)", marginTop: 2, lineHeight: 1.45 }}>
                  {[chapterTitle(p.chapter), p.shape, p.kind === "code" ? p.reference.label : p.kind === "build" ? `${p.minutes}-minute build` : p.kind === "design" ? "design lab" : ""].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className={`chip ${p.level.toLowerCase()}`}>{p.level}</span>
            </Link>
          );
        })}
        {!list.length && <p style={{ padding: 16, color: "var(--ink-2)", margin: 0 }}>No problems match those filters.</p>}
      </div>
      )}
      <p style={{ color: "var(--ink-3)", fontSize: 13, marginTop: 12 }}>More chapters, and their ladders, are on the way. See the full syllabus in the library.</p>
    </div>
  );
}
