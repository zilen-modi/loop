"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Lock } from "lucide-react";
import { books, chapterCount, type BookId } from "@/content/syllabus";
import { problems, problemsForChapter } from "@/content/problems";
import { problemsProgress, reading } from "@/lib/progress";
import { useMounted } from "@/lib/use-mounted";
import Today from "./Today";

const coverHue: Record<BookId, string> = { dsa: "var(--hue-teal)", lld: "var(--hue-violet)", hld: "var(--hue-amber)" };
const coverLabel: Record<BookId, string> = { dsa: "Book 1", lld: "Book 2", hld: "Book 3" };

/** The home screen: your books, like a Kindle library, plus what's due today. */
export default function Library() {
  const [open, setOpen] = useState<BookId>("dsa");
  const [onlyReady, setOnlyReady] = useState(false);
  const mounted = useMounted();
  const read = reading.use();
  const solved = problemsProgress.use();

  const solvedCount = mounted ? Object.values(solved).filter((p) => p.status === "solved").length : 0;

  const book = books.find((b) => b.id === open)!;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 36 }}>
      <Today />
      <section aria-label="Practice" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))", gap: 12 }}>
        <Link href="/top" className="card" style={{ padding: "16px 18px", textDecoration: "none", display: "grid", gap: 6 }}>
          <span className="kicker">Top questions</span>
          <span style={{ fontFamily: "var(--serif)", fontSize: 20 }}>Coding, design, behavioral</span>
          <span style={{ color: "var(--ink-2)", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>The ones that come up again and again <ArrowRight size={14} /></span>
        </Link>
        <Link href="/problems" className="card" style={{ padding: "16px 18px", textDecoration: "none", display: "grid", gap: 6 }}>
          <span className="kicker">Problems</span>
          <span style={{ fontFamily: "var(--serif)", fontSize: 20 }}>{solvedCount} of {problems.length} solved</span>
          <span style={{ color: "var(--ink-2)", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>Every chapter ends with a ladder <ArrowRight size={14} /></span>
        </Link>
      </section>

      <section aria-labelledby="books">
        <h2 id="books" className="kicker" style={{ margin: "0 0 14px" }}>Your books</h2>
        <div className="covers" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 18 }}>
          {books.map((b) => {
            const total = chapterCount(b);
            const ready = b.parts.reduce((n, p) => n + p.chapters.filter((c) => c.available).length, 0);
            return (
              <button
                key={b.id}
                onClick={() => setOpen(b.id)}
                aria-pressed={open === b.id}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  display: "grid",
                  gridTemplateRows: "auto 1fr auto",
                  aspectRatio: "3 / 4",
                  borderRadius: "4px 12px 12px 4px",
                  background: "var(--page)",
                  borderTop: `1px solid ${open === b.id ? "var(--ink-3)" : "var(--rule)"}`,
                  borderRight: `1px solid ${open === b.id ? "var(--ink-3)" : "var(--rule)"}`,
                  borderBottom: `1px solid ${open === b.id ? "var(--ink-3)" : "var(--rule)"}`,
                  boxShadow: open === b.id ? "var(--shadow)" : "none",
                  borderLeft: `10px solid ${coverHue[b.id]}`,
                  padding: "18px 18px 16px",
                  transition: "box-shadow .2s, border-color .2s",
                }}
              >
                <span className="kicker">{coverLabel[b.id]}</span>
                <span className="cover-title" style={{ fontFamily: "var(--serif)", fontSize: 21, lineHeight: 1.2, alignSelf: "center" }}>{b.title}</span>
                <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
                  <span style={{ whiteSpace: "nowrap" }}>{total} chapters</span> · <span style={{ whiteSpace: "nowrap" }}>{ready} ready</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="contents">
        <h2 id="contents" style={{ fontFamily: "var(--serif)", fontWeight: 500, fontSize: 24, margin: "0 0 4px" }}>{book.title}</h2>
        <p style={{ color: "var(--ink-2)", margin: "0 0 20px" }}>{book.subtitle}</p>
        <label className="toc-only">
          <input type="checkbox" checked={onlyReady} onChange={(e) => setOnlyReady(e.target.checked)} /> Only ready chapters
        </label>
        <div className="toc-wrap">
          <table className="toc-table" data-testid="toc-table">
            <thead>
              <tr>
                <th scope="col" className="num">#</th>
                <th scope="col">Chapter</th>
                <th scope="col" className="toc-problems">Problems</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            {book.parts.map((part, pi) => {
              const rows = part.chapters.filter((c) => !onlyReady || c.available || (c.slug && problemsForChapter(c.slug).length));
              if (!rows.length) return null;
              const ready = part.chapters.filter((c) => c.available).length;
              return (
                <tbody key={part.title}>
                  <tr className="toc-part">
                    <th scope="colgroup" colSpan={4}>
                      <span>Part {String.fromCharCode(65 + pi)} · {part.title}</span>
                      <span className="toc-part-count">{ready ? `${ready} of ${part.chapters.length} ready` : `${part.chapters.length} chapters`}</span>
                    </th>
                  </tr>
                  {rows.map((c) => {
                    const key = `${book.id}/${c.slug}`;
                    const started = mounted && c.slug && read[key];
                    const list = c.slug ? problemsForChapter(c.slug) : [];
                    const done = mounted ? list.filter((x) => solved[x.id]?.status === "solved").length : 0;
                    const problemsCell = list.length ? (
                      <Link href={`/problems?chapter=${c.slug}`} className="toc-count">
                        {done ? `${done} of ${list.length} solved` : `${list.length} ${list.length === 1 ? "problem" : "problems"}`}
                      </Link>
                    ) : (
                      <span className="toc-none">—</span>
                    );
                    return (
                      <tr key={c.n} data-ready={c.available || undefined}>
                        <td className="num">{c.n}</td>
                        <th scope="row">
                          {c.available ? <Link href={`/learn/${key}`} className="toc-title">{c.title}</Link> : <span className="toc-title">{c.title}</span>}
                          {c.newFormat && <span className="chip new toc-new" title="Covers a newer interview format">◆ new format</span>}
                          {list.length > 0 && <span className="toc-sub">{problemsCell}</span>}
                        </th>
                        <td className="toc-problems">{problemsCell}</td>
                        <td>
                          {c.available ? (
                            started && read[key].finished ? (
                              <span className="chip easy" data-status="finished"><Check size={12} aria-hidden="true" /> Finished</span>
                            ) : started ? (
                              <span className="chip new" data-status="reading">Reading</span>
                            ) : (
                              <Link href={`/learn/${key}`} className="toc-start" data-status="new" aria-label={`Start ${c.title}`}>Start <ArrowRight size={13} aria-hidden="true" /></Link>
                            )
                          ) : (
                            <span className="toc-soon"><Lock size={12} aria-hidden="true" /> Soon</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
          </table>
        </div>
      </section>
    </div>
  );
}
