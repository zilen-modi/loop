// Builds the ⌘K search index from the syllabus, chapter files, concepts, problems and top questions.
// `npm run gen:search` writes it; check-content fails if the committed copy is out of date.

import { readFileSync } from "fs";
import { join } from "path";
import { books } from "@/content/syllabus";
import { concepts } from "@/content/concepts";
import { problems } from "@/content/problems";
import { hldQuestions, lldQuestions } from "@/content/top/design";
import type { SearchEntry } from "@/lib/search";

const ROOT = join(__dirname, "..");
const SHORT = { dsa: "DSA", lld: "LLD", hld: "HLD" } as const;

export function buildSearchIndex(): SearchEntry[] {
  const entries: SearchEntry[] = [
    { kind: "page", title: "Library", sub: "Home: your books and what's due today", href: "/" },
    { kind: "page", title: "Top questions", sub: "The most asked coding, design and behavioural questions", href: "/top" },
    { kind: "page", title: "Problems", sub: "Every problem, build and design lab", href: "/problems" },
    { kind: "page", title: "Practice", sub: "Re-solves and review cards", href: "/practice" },
  ];
  const chapterFiles = readFileSync(join(ROOT, "content/chapters/index.ts"), "utf8");
  const fileFor = (key: string) => chapterFiles.match(new RegExp(`"${key}": \\(\\) => import\\("\\./([^"]+)"\\)`))?.[1];
  const conceptHome: Record<string, { title: string; href: string }> = {};
  const chapterHref: Record<string, string> = {}; // "lld:28" → href
  const chapterTitle: Record<string, string> = {}; // slug → title
  for (const b of books) {
    for (const part of b.parts) {
      for (const c of part.chapters) {
        if (!c.available || !c.slug) continue;
        const href = `/learn/${b.id}/${c.slug}`;
        const sub = `${SHORT[b.id]} ${c.n} · ${part.title}`;
        chapterHref[`${b.id}:${c.n}`] = href;
        chapterTitle[c.slug] = c.title;
        entries.push({ kind: "chapter", title: c.title, sub, href });
        const file = fileFor(`${b.id}/${c.slug}`);
        if (!file) continue;
        const mdx = readFileSync(join(ROOT, "content/chapters", file), "utf8");
        for (const m of mdx.matchAll(/^## (.+)$/gm)) {
          const h = m[1].trim();
          if (["Your turn", "Explain it back", "Recap", "In interviews", "Try it in the lab"].includes(h)) continue;
          entries.push({ kind: "section", title: h, sub: `${c.title} · ${SHORT[b.id]} ${c.n}`, href });
        }
        const head = mdx.match(/<ChapterHead[^>]*concept="([^"]+)"/)?.[1];
        const terms = [...(head ? [head] : []), ...[...mdx.matchAll(/<Term id="([^"]+)"/g)].map((m) => m[1])];
        for (const t of terms) if (!conceptHome[t]) conceptHome[t] = { title: c.title, href };
      }
    }
  }
  for (const c of Object.values(concepts)) {
    const home = conceptHome[c.id];
    if (!home) continue; // only concepts a chapter teaches are linkable
    entries.push({ kind: "concept", title: c.term, sub: `Concept · ${home.title}`, href: home.href, text: c.definition });
  }
  for (const p of problems) {
    const what = p.kind === "build" ? "Machine-coding build" : p.kind === "design" ? "Design lab" : p.kind === "bug-hunt" ? "Bug hunt" : "Coding problem";
    entries.push({ kind: "problem", title: p.title, sub: `${what} · ${p.level}`, href: `/problems/${p.id}`, text: `${p.shape} ${chapterTitle[p.chapter] ?? ""}` });
  }
  for (const [book, list] of [["lld", lldQuestions], ["hld", hldQuestions]] as const) {
    for (const q of list) {
      const href = chapterHref[`${book}:${q.chapter}`];
      entries.push({ kind: "question", title: q.title, sub: `Top ${SHORT[book]} question${href ? "" : " · chapter coming soon"}`, href: href ?? "/top", text: q.tests });
    }
  }
  return entries;
}
