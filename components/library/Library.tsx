"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Lock, Repeat } from "lucide-react";
import { books, chapterCount, findChapter, type BookId } from "@/content/syllabus";
import { problems, problemsForChapter } from "@/content/problems";
import { cards, problemsProgress, reading } from "@/lib/progress";
import { useMounted } from "@/lib/use-mounted";

const coverHue: Record<BookId, string> = { dsa: "var(--hue-teal)", lld: "var(--hue-violet)", hld: "var(--hue-amber)" };
const coverLabel: Record<BookId, string> = { dsa: "Book 1", lld: "Book 2", hld: "Book 3" };

/** The home screen: your books, like a Kindle library, plus what's due today. */
export default function Library() {
  const [open, setOpen] = useState<BookId>("dsa");
  const mounted = useMounted();
  const read = reading.use();
  const solved = problemsProgress.use();
  const allCards = cards.use();
  const now = Date.now();

  const lastKey = Object.keys(read)[0];
  const last = lastKey ? findChapter(lastKey.split("/")[0], lastKey.split("/")[1]) : null;
  const dueProblems = mounted ? Object.values(solved).filter((p) => p.due && p.due <= now).length : 0;
  const dueCards = mounted ? Object.values(allCards).filter((c) => c.due <= now).length : 0;
  const solvedCount = mounted ? Object.values(solved).filter((p) => p.status === "solved").length : 0;

  const book = books.find((b) => b.id === open)!;

  return (
    <div style={{ display: "grid", gap: 36 }}>
      <section aria-labelledby="today" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        <h1 id="today" className="sr-only">Your library</h1>
        <Link href={last ? `/learn/${lastKey}` : "/learn/dsa/sliding-window"} className="card" style={{ padding: "16px 18px", textDecoration: "none", display: "grid", gap: 6 }}>
          <span className="kicker">{last && mounted ? "Continue reading" : "Start here"}</span>
          <span style={{ fontFamily: "var(--serif)", fontSize: 20 }}>{last && mounted ? last.chapter.title : "Sliding window"}</span>
          <span style={{ color: "var(--ink-2)", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            {last && mounted ? `${last.book.title} · Chapter ${last.chapter.n}` : "Data structures and algorithms · Chapter 9"} <ArrowRight size={14} />
          </span>
        </Link>
        <Link href="/practice" className="card" style={{ padding: "16px 18px", textDecoration: "none", display: "grid", gap: 6 }}>
          <span className="kicker">Due today</span>
          <span style={{ fontFamily: "var(--serif)", fontSize: 20 }}>
            {dueProblems + dueCards === 0 ? "Nothing due" : `${dueProblems} re-solve${dueProblems === 1 ? "" : "s"} · ${dueCards} card${dueCards === 1 ? "" : "s"}`}
          </span>
          <span style={{ color: "var(--ink-2)", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
            <Repeat size={14} /> Spaced practice keeps what you learn
          </span>
        </Link>
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 18 }}>
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
                  border: `1px solid ${open === b.id ? "var(--ink-3)" : "var(--rule)"}`,
                  boxShadow: open === b.id ? "var(--shadow)" : "none",
                  borderLeft: `10px solid ${coverHue[b.id]}`,
                  padding: "18px 18px 16px",
                  transition: "box-shadow .2s, border-color .2s",
                }}
              >
                <span className="kicker">{coverLabel[b.id]}</span>
                <span style={{ fontFamily: "var(--serif)", fontSize: 21, lineHeight: 1.2, alignSelf: "center" }}>{b.title}</span>
                <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
                  {total} chapters · {ready} ready
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="contents">
        <h2 id="contents" style={{ fontFamily: "var(--serif)", fontWeight: 500, fontSize: 24, margin: "0 0 4px" }}>{book.title}</h2>
        <p style={{ color: "var(--ink-2)", margin: "0 0 20px" }}>{book.subtitle}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "8px 32px" }}>
          {book.parts.map((part, pi) => (
            <div key={part.title} style={{ breakInside: "avoid", marginBottom: 14 }}>
              <p className="kicker" style={{ margin: "0 0 6px" }}>Part {String.fromCharCode(65 + pi)} · {part.title}</p>
              <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {part.chapters.map((c) => {
                  const key = `${book.id}/${c.slug}`;
                  const started = mounted && c.slug && read[key];
                  const row = (
                    <span style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--rule)" }}>
                      <span style={{ width: 22, color: "var(--ink-3)", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>{c.n}</span>
                      <span style={{ flex: 1, fontFamily: "var(--serif)", fontSize: 15.5, color: c.available ? "var(--ink)" : "var(--ink-3)" }}>{c.title}</span>
                      {c.newFormat && <span className="chip new" title="Covers a newer interview format">◆ new format</span>}
                      {c.available ? (
                        <span className="chip easy">{started ? (read[key].finished ? "Finished" : "Reading") : "Read"}</span>
                      ) : c.slug && problemsForChapter(c.slug).length ? (
                        <span className="chip new">{problemsForChapter(c.slug).length} problems</span>
                      ) : (
                        <span style={{ color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                          <Lock size={12} aria-hidden="true" /> Soon
                        </span>
                      )}
                    </span>
                  );
                  return (
                    <li key={c.n}>
                      {c.available ? (
                        <Link href={`/learn/${key}`} style={{ textDecoration: "none" }}>{row}</Link>
                      ) : c.slug && problemsForChapter(c.slug).length ? (
                        <Link href={`/problems?chapter=${c.slug}`} style={{ textDecoration: "none" }}>{row}</Link>
                      ) : (
                        row
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
