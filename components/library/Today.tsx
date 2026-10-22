"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Code2, Hammer, Layers3, Repeat, Sparkles } from "lucide-react";
import type { Problem } from "@/content/problem-types";
import { problemById } from "@/content/problems";
import { books, type BookId } from "@/content/syllabus";
import { cards, problemsProgress, reading } from "@/lib/progress";
import { useMounted } from "@/lib/use-mounted";

const DAY = 24 * 60 * 60 * 1000;
const kindIcon = { code: Code2, "bug-hunt": Code2, build: Hammer, design: Layers3 };
const kindLabel = { code: "Coding", "bug-hunt": "Code review", build: "Machine coding", design: "Design lab" };

/** The book a chapter slug belongs to. */
const bookOf = (slug: string) => books.find((b) => b.parts.some((p) => p.chapters.some((c) => c.slug === slug)));

/** Today: re-solves due across all three tracks, review cards, and what to read next in each book. */
export default function Today() {
  const mounted = useMounted();
  const progress = problemsProgress.use();
  const allCards = cards.use();
  const read = reading.use();
  const now = Date.now();

  const due = mounted
    ? Object.entries(progress)
        .filter(([, s]) => s.due && s.due <= now)
        .map(([id, s]) => ({ p: problemById(id), due: s.due! }))
        .filter((x): x is { p: Problem; due: number } => !!x.p)
        .sort((a, b) => a.due - b.due)
    : [];
  const dueCards = mounted ? Object.values(allCards).filter((c) => c.due <= now).length : 0;

  // The most recently read chapter, and the next unfinished chapter in each book.
  const recent = mounted ? Object.entries(read).filter(([, c]) => !c.finished).sort((a, b) => (b[1].lastRead ?? 0) - (a[1].lastRead ?? 0))[0] : undefined;
  const nextUp = books.map((b) => {
    const ch = b.parts.flatMap((p) => p.chapters).find((c) => c.available && c.slug && !(mounted && read[`${b.id}/${c.slug}`]?.finished));
    return ch ? { book: b, ch, key: `${b.id}/${ch.slug}`, started: mounted && !!read[`${b.id}/${ch.slug}`] } : null;
  }).filter(Boolean) as { book: (typeof books)[number]; ch: { n: number; title: string; slug?: string }; key: string; started: boolean }[];
  const recentRef = recent ? (() => {
    const [bookId, slug] = recent[0].split("/") as [BookId, string];
    const b = books.find((x) => x.id === bookId);
    const ch = b?.parts.flatMap((p) => p.chapters).find((c) => c.slug === slug);
    return b && ch ? { key: recent[0], title: ch.title, label: `${b.title} · Chapter ${ch.n}` } : null;
  })() : null;

  return (
    <section aria-labelledby="today-title" className="today">
      <div className="today-head">
        <h1 id="today-title" style={{ fontFamily: "var(--serif)", fontWeight: 500, fontSize: 26, margin: 0 }}>Today</h1>
        <span style={{ color: "var(--ink-3)", fontSize: 13 }} suppressHydrationWarning>
          {mounted ? new Date(now).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : ""}
        </span>
      </div>
      <div className="today-grid">
        <div className="card today-card" data-testid="today-resolve">
          <p className="kicker" style={{ margin: 0, display: "flex", gap: 6, alignItems: "center" }}><Repeat size={13} aria-hidden="true" /> Re-solve · {due.length} due</p>
          {due.length ? (
            <ul className="today-list">
              {due.slice(0, 5).map(({ p, due: d }) => {
                const Icon = kindIcon[p.kind];
                const book = bookOf(p.chapter);
                const days = Math.floor((now - d) / DAY);
                return (
                  <li key={p.id}>
                    <Link href={`/problems/${p.id}?from=${encodeURIComponent("/")}`} data-due={p.id}>
                      <Icon size={16} aria-hidden="true" />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span className="today-title">{p.title}</span>
                        <span className="today-meta">{kindLabel[p.kind]}{book ? ` · ${book.id.toUpperCase()}` : ""} · {days < 1 ? "due today" : `${days} day${days === 1 ? "" : "s"} overdue`}</span>
                      </span>
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
              {due.length > 5 && <li className="today-more"><Link href="/practice">and {due.length - 5} more in Practice</Link></li>}
            </ul>
          ) : (
            <p className="today-empty">Nothing due. Problems, builds and labs you solve come back after 1, 3, 7 and 21 days, which is what makes them stick.</p>
          )}
        </div>

        <Link href="/practice" className="card today-card" data-testid="today-cards" style={{ textDecoration: "none" }}>
          <p className="kicker" style={{ margin: 0, display: "flex", gap: 6, alignItems: "center" }}><Sparkles size={13} aria-hidden="true" /> Review cards</p>
          <span style={{ fontFamily: "var(--serif)", fontSize: 22 }}>{dueCards ? `${dueCards} card${dueCards === 1 ? "" : "s"} due` : "None due"}</span>
          <span className="today-meta">{dueCards ? "A few minutes, from your highlights and chapter recaps." : "Highlight a line or finish a chapter, and it turns into a card."} <ArrowRight size={13} aria-hidden="true" /></span>
        </Link>

        <div className="card today-card" data-testid="today-read">
          <p className="kicker" style={{ margin: 0, display: "flex", gap: 6, alignItems: "center" }}><BookOpen size={13} aria-hidden="true" /> Keep reading</p>
          {recentRef && (
            <Link href={`/learn/${recentRef.key}`} className="today-continue" data-continue={recentRef.key}>
              <span className="today-title">Continue: {recentRef.title}</span>
              <span className="today-meta">{recentRef.label}</span>
            </Link>
          )}
          <ul className="today-list">
            {nextUp.filter((x) => x.key !== recentRef?.key).map((x) => (
              <li key={x.key}>
                <Link href={`/learn/${x.key}`} data-next={x.key}>
                  <span className="today-book" style={{ background: `var(--hue-${x.book.id === "dsa" ? "teal" : x.book.id === "lld" ? "violet" : "amber"})` }} aria-hidden="true" />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="today-title">{x.ch.title}</span>
                    <span className="today-meta">{x.book.title} · Chapter {x.ch.n}{x.started ? " · started" : ""}</span>
                  </span>
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
