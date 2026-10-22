"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Highlighter, ListTree, Type } from "lucide-react";
import { applyTheme, FONT_SIZES, LINE_HEIGHTS, MARGINS, settings } from "@/lib/settings";
import { addCard, clozeFromHighlight, pace, reading, recordPageRead, removeCard, updateChapter, type Highlight } from "@/lib/progress";
import { clearMarks, isTextBlock, offsetIn, wrapRange } from "@/lib/highlight-dom";
import SettingsSheet from "./SettingsSheet";
import { turnPage, type FlipHandle } from "@/lib/page-flip";
import { usePrefersReducedMotion } from "@/lib/use-mounted";
import XRayPopover from "./XRayPopover";
import SelectionMenu, { type SelectionState } from "./SelectionMenu";
import HighlightsDrawer from "./HighlightsDrawer";
import ContentsDrawer from "./ContentsDrawer";

type ReaderCtx = { chapterKey: string; chapterTitle: string; openTerm: (id: string, el: HTMLElement) => void };
const Ctx = createContext<ReaderCtx>({ chapterKey: "", chapterTitle: "", openTerm: () => {} });
export const useReader = () => useContext(Ctx);

type Props = {
  chapterKey: string;
  title: string;
  bookTitle: string;
  chapterLabel: string;
  children: React.ReactNode;
};

const TOP = 66;    // room for the top bar
const BOTTOM = 40; // room for the location line
const CHARS_PER_LOCATION = 150;
const CHARS_PER_WORD = 5.5;

export default function Reader({ chapterKey, title, bookTitle, chapterLabel, children }: Props) {
  const s = settings.use();
  const wpm = pace.use().wpm;
  const chapter = reading.use()[chapterKey];
  const highlights = useMemo(() => chapter?.highlights ?? [], [chapter?.highlights]);

  const viewportRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [anchor, setAnchor] = useState(0);
  const [animate, setAnimate] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [panel, setPanel] = useState<null | "settings" | "highlights" | "contents">(null);
  const [term, setTerm] = useState<{ id: string; rect: DOMRect } | null>(null);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [offsets, setOffsets] = useState<{ starts: number[]; total: number }>({ starts: [0], total: 1 });
  const arrivedAt = useRef(Date.now());
  const swipe = useRef<{ x: number; y: number; t: string } | null>(null);
  const suppressClick = useRef(false);
  const restored = useRef(false);
  const flipLayerRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<FlipHandle | null>(null);
  const pageRef = useRef(0);
  pageRef.current = page;
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => applyTheme(s.theme), [s.theme]);

  // ——— layout: column width, gap, pages per view
  const size = FONT_SIZES[s.size];
  const margin = MARGINS[s.margins];
  const layout = useMemo(() => {
    const availW = Math.max(240, box.w - margin * 2);
    const measure = size * 34; // about 65 characters per line
    const gap = Math.max(48, margin * 2);
    const perView = s.spread && box.w >= 1100 ? 2 : 1;
    const colW = Math.floor(perView === 2 ? Math.min((availW - gap) / 2, measure) : Math.min(availW, measure));
    const frameW = perView * colW + (perView - 1) * gap;
    const pageH = Math.max(280, box.h - TOP - BOTTOM);
    return { colW, gap, perView, frameW, pageH, step: perView * (colW + gap) };
  }, [box, size, margin, s.spread]);

  useLayoutEffect(() => {
    const vp = viewportRef.current!;
    const ro = new ResizeObserver(() => setBox({ w: vp.clientWidth, h: vp.clientHeight }));
    ro.observe(vp);
    return () => ro.disconnect();
  }, []);

  const blocks = useCallback(() => Array.from(articleRef.current?.children ?? []) as HTMLElement[], []);

  const pageOf = useCallback(
    (el: Element) => {
      const art = articleRef.current;
      if (!art) return 0;
      const x = el.getBoundingClientRect().left - art.getBoundingClientRect().left;
      return Math.max(0, Math.floor((x + 2) / layout.step));
    },
    [layout.step],
  );

  // Character offsets of each block, for Kindle-style locations and time left.
  useLayoutEffect(() => {
    const list = blocks();
    const starts: number[] = [];
    let total = 0;
    for (const b of list) {
      starts.push(total);
      total += (b.textContent ?? "").length;
    }
    setOffsets({ starts, total: Math.max(total, 1) });
  }, [blocks, children]);

  // After every layout change: count pages and keep the reader on the same passage.
  useLayoutEffect(() => {
    const art = articleRef.current;
    if (!art || !box.w) return;
    flipRef.current?.finish();
    const list = blocks();
    const last = list[list.length - 1];
    const artLeft = art.getBoundingClientRect().left;
    const right = last ? Math.max(...list.map((b) => b.getBoundingClientRect().right)) - artLeft : layout.colW;
    const count = Math.max(1, Math.ceil((right + layout.gap - 2) / layout.step));
    setPages(count);
    const target = restored.current ? anchor : (chapter?.anchor ?? 0);
    restored.current = true;
    const el = list[Math.min(target, list.length - 1)];
    setAnimate(false);
    setPage(el ? Math.min(pageOf(el), count - 1) : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, s.typeface, s.spacing, blocks, pageOf]);

  // The block at the top of the current page becomes the saved location.
  useEffect(() => {
    const list = blocks();
    if (!list.length) return;
    let a = 0;
    for (let i = 0; i < list.length; i++) {
      const p = pageOf(list[i]);
      if (p <= page) a = i;
      if (p >= page) {
        a = p === page ? i : a;
        break;
      }
    }
    setAnchor(a);
    const t = setTimeout(() => updateChapter(chapterKey, (c) => ({ ...c, anchor: a, finished: c.finished || page >= pages - 1, lastRead: Date.now() })), 300);
    return () => clearTimeout(t);
  }, [page, pages, blocks, pageOf, chapterKey]);

  const go = useCallback(
    (delta: number) => {
      setPanel(null);
      setTerm(null);
      setSelection(null);
      setChrome(false);
      flipRef.current?.finish(); // a quick second press completes the turn in progress
      const p = pageRef.current;
      const next = Math.min(Math.max(p + delta, 0), pages - 1);
      if (next === p) return;
      if (delta > 0) {
        const startChars = offsets.starts[anchor] ?? 0;
        const wordsOnPage = Math.max(0, ((offsets.starts[anchor + 3] ?? offsets.total) - startChars) / CHARS_PER_WORD);
        recordPageRead(wordsOnPage, (Date.now() - arrivedAt.current) / 1000);
      }
      arrivedAt.current = Date.now();
      const commit = () => {
        pageRef.current = next;
        setPage(next);
      };
      const mode = reduceMotion ? "none" : s.turn;
      if (mode === "flip" && articleRef.current && flipLayerRef.current) {
        setAnimate(false);
        const handle = turnPage(flipLayerRef.current, articleRef.current, layout, p, next, commit);
        flipRef.current = handle;
        return;
      }
      setAnimate(mode === "slide");
      commit();
    },
    [pages, offsets, anchor, reduceMotion, s.turn, layout],
  );

  const goToElement = useCallback(
    (el: Element) => {
      setAnimate(false);
      setPage(Math.min(pageOf(el), pages - 1));
      setPanel(null);
    },
    [pageOf, pages],
  );

  // ——— input: keyboard, taps on the page edges, swipes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable], .cm-editor")) return;
      if (e.key === "Escape") {
        setPanel(null);
        setTerm(null);
        setSelection(null);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || (e.key === " " && !e.shiftKey)) {
        if (t.closest("button, a, [role=button]") && e.key === " ") return;
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp" || (e.key === " " && e.shiftKey)) {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // Only real controls block a page turn; tapping the blank part of a figure still turns.
  const interactive = (t: HTMLElement) => !!t.closest("button, a, [role=button], input, textarea, select, label, summary, table, .cm-editor, mark[data-hl]");

  function onClick(e: React.MouseEvent) {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    const t = e.target as HTMLElement;
    if (t.closest("mark[data-hl]")) {
      const id = (t.closest("mark[data-hl]") as HTMLElement).dataset.hl!;
      const h = highlights.find((x) => x.id === id);
      if (h) setSelection({ kind: "existing", highlight: h, rect: (t as HTMLElement).getBoundingClientRect() });
      return;
    }
    if (interactive(t) || window.getSelection()?.toString()) return;
    const vp = viewportRef.current!.getBoundingClientRect();
    const x = (e.clientX - vp.left) / vp.width;
    if (x < 0.3) go(-1);
    else if (x > 0.7) go(1);
    else {
      setChrome((c) => !c);
      setPanel(null);
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    swipe.current = { x: e.clientX, y: e.clientY, t: e.pointerType };
  }

  function onPointerUp(e: React.PointerEvent) {
    const s0 = swipe.current;
    swipe.current = null;
    if (!s0 || s0.t === "mouse") {
      captureSelection();
      return;
    }
    const dx = e.clientX - s0.x;
    const dy = e.clientY - s0.y;
    if (Math.abs(dx) > 50 && Math.abs(dy) < 60 && !interactive(e.target as HTMLElement)) {
      suppressClick.current = true;
      go(dx < 0 ? 1 : -1);
    } else captureSelection();
  }

  // Tabbing to something on another page brings that page into view.
  function onFocusCapture(e: React.FocusEvent) {
    const p = pageOf(e.target as Element);
    if (p !== page) {
      setAnimate(false);
      setPage(Math.min(p, pages - 1));
    }
  }

  // ——— highlights
  function captureSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    const art = articleRef.current!;
    const blockOf = (n: Node) => {
      let el: Node | null = n.nodeType === Node.TEXT_NODE ? n.parentNode : n;
      while (el && el.parentNode !== art) el = el.parentNode;
      return el as HTMLElement | null;
    };
    const block = blockOf(range.startContainer);
    if (!block || block !== blockOf(range.endContainer) || !isTextBlock(block)) return;
    const start = offsetIn(block, range.startContainer, range.startOffset);
    const end = offsetIn(block, range.endContainer, range.endOffset);
    const text = (block.textContent ?? "").slice(start, end).trim();
    if (!text) return;
    setSelection({ kind: "new", block: blocks().indexOf(block), start, end, text, rect: range.getBoundingClientRect() });
  }

  function saveHighlight(sel: Extract<SelectionState, { kind: "new" }>, note?: string) {
    const h: Highlight = { id: Math.random().toString(36).slice(2, 10), block: sel.block, start: sel.start, end: sel.end, text: sel.text, note, createdAt: Date.now() };
    updateChapter(chapterKey, (c) => ({ ...c, highlights: [...c.highlights, h] }));
    const cloze = clozeFromHighlight(h.text);
    addCard({ id: `hl:${chapterKey}:${h.id}`, source: `${title} · your highlight`, front: cloze.front, back: note ? `${cloze.back}\n\nYour note: ${note}` : cloze.back });
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }

  function removeHighlight(id: string) {
    updateChapter(chapterKey, (c) => ({ ...c, highlights: c.highlights.filter((h) => h.id !== id) }));
    removeCard(`hl:${chapterKey}:${id}`);
    setSelection(null);
  }

  function setNote(id: string, note: string) {
    updateChapter(chapterKey, (c) => ({ ...c, highlights: c.highlights.map((h) => (h.id === id ? { ...h, note: note || undefined } : h)) }));
    setSelection(null);
  }

  useLayoutEffect(() => {
    const art = articleRef.current;
    if (!art) return;
    clearMarks(art);
    const list = blocks();
    for (const h of highlights) {
      const b = list[h.block];
      if (b) wrapRange(b, h.start, h.end, h.id, !!h.note);
    }
  }, [highlights, blocks]);

  const openTerm = useCallback((id: string, el: HTMLElement) => setTerm({ id, rect: el.getBoundingClientRect() }), []);
  const ctx = useMemo(() => ({ chapterKey, chapterTitle: title, openTerm }), [chapterKey, title, openTerm]);

  // ——— progress text
  const at = offsets.starts[anchor] ?? 0;
  const location = Math.floor(at / CHARS_PER_LOCATION) + 1;
  const locations = Math.ceil(offsets.total / CHARS_PER_LOCATION);
  const minutesLeft = Math.max(1, Math.round((offsets.total - at) / CHARS_PER_WORD / wpm));
  const progress = pages > 1 ? page / (pages - 1) : 1;
  const leftText = page >= pages - 1 ? "End of chapter" : `${minutesLeft} min left in chapter`;

  const fontVar = s.typeface === "serif" ? "var(--serif)" : "var(--sans)";

  return (
    <Ctx.Provider value={ctx}>
      <div className="reader" style={{ ["--reader-font" as string]: fontVar }}>
        <header className={`reader-chrome top${chrome || panel ? "" : " hidden"}`}>
          <Link href="/" className="icon-btn" aria-label="Back to library"><ChevronLeft size={20} /></Link>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: "var(--ink)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
            <div style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bookTitle} · {chapterLabel}</div>
          </div>
          <button className="icon-btn" aria-label="Contents" aria-expanded={panel === "contents"} onClick={() => setPanel(panel === "contents" ? null : "contents")}><ListTree size={18} /></button>
          <button className="icon-btn" aria-label="Your highlights" aria-expanded={panel === "highlights"} onClick={() => setPanel(panel === "highlights" ? null : "highlights")}><Highlighter size={18} /></button>
          <button className="icon-btn" aria-label="Text and theme settings" aria-expanded={panel === "settings"} onClick={() => setPanel(panel === "settings" ? null : "settings")}><Type size={18} /></button>
        </header>

        <div
          ref={viewportRef}
          className="reader-viewport"
          onClick={onClick}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onKeyUp={(e) => e.shiftKey && captureSelection()}
          style={{ paddingTop: TOP, paddingBottom: BOTTOM }}
        >
          <div className="reader-frame" style={{ width: layout.frameW, height: layout.pageH }}>
            <article
              ref={articleRef}
              className={`reader-article prose${animate ? "" : " no-anim"}`}
              aria-label={title}
              onFocusCapture={onFocusCapture}
              style={{
                width: layout.frameW,
                columnWidth: layout.colW,
                columnGap: layout.gap,
                ["--reader-size" as string]: `${size}px`,
                ["--reader-leading" as string]: LINE_HEIGHTS[s.spacing],
                transform: `translateX(${-page * layout.step}px)`,
              }}
            >
              {children}
            </article>
            <div ref={flipLayerRef} className="flip-layer" aria-hidden="true" />
          </div>
          <p className="reader-foot-min" aria-hidden={chrome}>
            {chrome ? "" : `Location ${location} · ${leftText}`}
          </p>
        </div>

        <footer className={`reader-chrome bottom${chrome ? "" : " hidden"}`} aria-label="Reading progress">
          <span style={{ whiteSpace: "nowrap" }}>Location {location} of {locations}</span>
          <div className="progress-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label="Chapter progress">
            <i style={{ width: `${progress * 100}%` }} />
          </div>
          <span style={{ whiteSpace: "nowrap" }}>{leftText}</span>
          <span className="sr-only" aria-live="polite">Page {page + 1} of {pages}</span>
        </footer>

        {panel === "settings" && <SettingsSheet wide={box.w >= 1100} onClose={() => setPanel(null)} />}
        {panel === "highlights" && (
          <HighlightsDrawer
            highlights={highlights}
            onGo={(h) => {
              const b = blocks()[h.block];
              if (b) goToElement(b);
            }}
            onRemove={removeHighlight}
            onClose={() => setPanel(null)}
          />
        )}
        {panel === "contents" && (
          <ContentsDrawer
            sections={blocks().filter((b) => b.matches("h1, h2")).map((b) => ({ el: b, title: b.textContent ?? "", page: pageOf(b) + 1 }))}
            current={page + 1}
            onGo={goToElement}
            onClose={() => setPanel(null)}
          />
        )}
        {term && <XRayPopover id={term.id} rect={term.rect} onClose={() => setTerm(null)} />}
        {selection && (
          <SelectionMenu
            state={selection}
            onHighlight={(note) => selection.kind === "new" && saveHighlight(selection, note)}
            onRemove={(id) => removeHighlight(id)}
            onNote={setNote}
            onClose={() => setSelection(null)}
          />
        )}
      </div>
    </Ctx.Provider>
  );
}
