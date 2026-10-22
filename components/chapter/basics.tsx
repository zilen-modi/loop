"use client";

import Link from "next/link";
import { concepts } from "@/content/concepts";
import ConceptGlyph from "@/components/ui/ConceptGlyph";
import { useReader } from "@/components/reader/Reader";

export function ChapterHead({ kicker, title, concept, meta }: { kicker: string; title: string; concept?: string; meta?: string }) {
  const c = concept ? concepts[concept] : undefined;
  return (
    <header className="chapter-head" style={{ marginBottom: "1.2em" }}>
      <p className="kicker" style={{ margin: "0 0 0.8em" }}>{kicker}</p>
      <h1>{title}</h1>
      {(c || meta) && (
        <p style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--sans)", fontSize: 13, color: "var(--ink-3)", margin: 0 }}>
          {c && <ConceptGlyph concept={c} size={24} />}
          {meta}
        </p>
      )}
    </header>
  );
}

export function Story({ when, children }: { when: string; children: React.ReactNode }) {
  return (
    <div className="story">
      <span className="kicker">Tiffin · {when}</span>
      {children}
    </div>
  );
}

/** A concept word with an X-Ray lookup. */
export function Term({ id, children }: { id: string; children: React.ReactNode }) {
  const { openTerm } = useReader();
  return (
    // An inline span (not a <button>) so a long term wraps with the sentence around it.
    <span
      role="button"
      tabIndex={0}
      className="term"
      onClick={(e) => openTerm(id, e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openTerm(id, e.currentTarget);
        }
      }}
      aria-haspopup="dialog"
    >
      {children}
    </span>
  );
}

export function PageBreak() {
  return <div className="page-break" aria-hidden="true" />;
}

export function Sources({ reviewed, items }: { reviewed: string; items: { label: string; href: string }[] }) {
  return (
    <div className="figure" style={{ fontSize: 13 }}>
      <p className="fig-label">Sources · last reviewed {reviewed}</p>
      <ul style={{ margin: 0, paddingLeft: 18, color: "var(--ink-2)" }}>
        {items.map((s) => (
          <li key={s.href}>
            <a href={s.href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>{s.label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProblemLink({ id, children }: { id: string; children: React.ReactNode }) {
  const { chapterKey } = useReader();
  return <Link href={`/problems/${id}?from=${encodeURIComponent(`/learn/${chapterKey}`)}`}>{children}</Link>;
}
