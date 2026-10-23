"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CornerDownLeft, FileText, Hash, Lightbulb, ListChecks, Search, Star } from "lucide-react";
import { kindLabel, search, type SearchEntry, type SearchKind } from "@/lib/search";

export const OPEN_SEARCH = "loop:open-search";
export const openSearch = () => window.dispatchEvent(new Event(OPEN_SEARCH));

const kindIcon: Record<SearchKind, typeof Search> = { page: BookOpen, chapter: BookOpen, section: Hash, concept: Lightbulb, problem: ListChecks, question: Star };

/** ⌘K / Ctrl+K anywhere: search chapters, sections, concepts, problems and top questions. */
export default function SearchPalette() {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [mac, setMac] = useState(true);

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
    const open = () => {
      const d = ref.current;
      if (!d || d.open) return;
      d.showModal();
      setQuery("");
      setActive(0);
      input.current?.focus();
      if (!entries) import("@/content/search-index.json").then((m) => setEntries(m.default as SearchEntry[]));
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (ref.current?.open) ref.current.close();
        else open();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH, open);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH, open);
    };
  }, [entries]);

  const results = useMemo(() => {
    if (!entries) return [];
    return query.trim() ? search(entries, query) : entries.filter((e) => e.kind === "page");
  }, [entries, query]);

  const go = (e: SearchEntry | undefined) => {
    if (!e) return;
    ref.current?.close();
    router.push(e.href);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = results.length;
      if (!n) return;
      const next = (active + (e.key === "ArrowDown" ? 1 : -1) + n) % n;
      setActive(next);
      document.getElementById(`search-opt-${next}`)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active]);
    }
  };

  return (
    <dialog ref={ref} className="search-dialog" aria-label="Search Loop">
      <div className="search-field">
        <Search size={18} aria-hidden="true" />
        <input
          ref={input}
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="search-results"
          aria-activedescendant={results.length ? `search-opt-${active}` : undefined}
          aria-autocomplete="list"
          aria-label="Search chapters, concepts and problems"
          placeholder="Search chapters, concepts, problems…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="button" className="search-close" onClick={() => ref.current?.close()} aria-label="Close search">
          <kbd className="search-kbd">esc</kbd>
          <span className="search-cancel">Cancel</span>
        </button>
      </div>
      <ul id="search-results" role="listbox" aria-label="Results" className="search-results">
        {results.map((r, i) => {
          const Icon = kindIcon[r.kind] ?? FileText;
          return (
            <li
              key={`${r.kind}-${r.href}-${r.title}`}
              id={`search-opt-${i}`}
              role="option"
              aria-selected={i === active}
              data-kind={r.kind}
              onMouseMove={() => setActive(i)}
              onClick={() => go(r)}
            >
              <Icon size={16} aria-hidden="true" className="search-icon" />
              <span className="search-text">
                <span className="search-title">{r.title}</span>
                <span className="search-sub">{r.sub}</span>
              </span>
              <span className="search-kind">{kindLabel[r.kind].replace(/s$/, "")}</span>
              {i === active && <CornerDownLeft size={14} aria-hidden="true" className="search-enter" />}
            </li>
          );
        })}
      </ul>
      {entries && query.trim() && !results.length && <p className="search-empty" role="status">Nothing matches “{query.trim()}”.</p>}
      {!entries && <p className="search-empty" role="status">Loading…</p>}
      <p className="search-foot">
        <span>↑ ↓ to move · Enter to open</span>
        <span>{mac ? "⌘K" : "Ctrl K"} opens this anywhere</span>
      </p>
    </dialog>
  );
}
