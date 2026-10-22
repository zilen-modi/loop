"use client";

import { createLocalStore } from "./local-store";

const DAY = 24 * 60 * 60 * 1000;

// ——— Reading: place in each chapter, checkpoint answers, highlights, explain-it-back

export type Highlight = { id: string; block: number; start: number; end: number; text: string; note?: string; createdAt: number };

export type ChapterState = {
  anchor: number;               // index of the block at the top of the last page read
  checkpoints: Record<string, number>; // checkpoint id → chosen option
  highlights: Highlight[];
  explain?: { text: string; covered: number[] };
  recapAdded?: boolean;
  finished?: boolean;
};

export const reading = createLocalStore<Record<string, ChapterState>>("loop:reading", {});

export const emptyChapter = (): ChapterState => ({ anchor: 0, checkpoints: {}, highlights: [] });

export function updateChapter(key: string, fn: (c: ChapterState) => ChapterState) {
  reading.set((all) => ({ ...all, [key]: fn(all[key] ?? emptyChapter()) }));
}

/** Personal reading speed in words per minute, learned from page turns. */
export const pace = createLocalStore<{ wpm: number; samples: number }>("loop:pace", { wpm: 220, samples: 0 });

export function recordPageRead(words: number, seconds: number) {
  if (seconds < 4 || seconds > 600 || words < 30) return; // skimming or away from the screen
  const wpm = Math.min(500, Math.max(100, (words / seconds) * 60));
  pace.set((p) => {
    const n = Math.min(p.samples, 19);
    return { wpm: (p.wpm * n + wpm) / (n + 1), samples: p.samples + 1 };
  });
}

// ——— Problems: status and the re-solve schedule (1, 3, 7, 21 days)

export const INTERVALS = [1, 3, 7, 21];

export type ProblemState = {
  status: "attempted" | "solved";
  attempts: number;
  hintsUsed: number;
  walkthroughSeen: boolean;
  step: number;     // position in INTERVALS
  due?: number;     // when to re-solve
  lastSolved?: number;
  code?: Record<string, string>; // per language
};

export const problemsProgress = createLocalStore<Record<string, ProblemState>>("loop:problems", {});

const blank = (): ProblemState => ({ status: "attempted", attempts: 0, hintsUsed: 0, walkthroughSeen: false, step: 0 });

export function updateProblem(id: string, fn: (p: ProblemState) => ProblemState) {
  problemsProgress.set((all) => ({ ...all, [id]: fn(all[id] ?? blank()) }));
}

/** A solve with no help moves to the next, longer interval; a solve that needed help starts over at 1 day. */
export function scheduleSolve(id: string, now = Date.now()) {
  updateProblem(id, (p) => {
    const helped = p.hintsUsed > 0 || p.walkthroughSeen;
    const step = p.status === "solved" && !helped ? Math.min(p.step + 1, INTERVALS.length - 1) : 0;
    return { ...p, status: "solved", step, lastSolved: now, due: now + INTERVALS[step] * DAY, hintsUsed: 0, walkthroughSeen: false };
  });
}

// ——— Review cards: highlights (as cloze cards) and chapter recap cards

export type Card = { id: string; source: string; front: string; back: string; due: number; step: number; createdAt: number };

export const cards = createLocalStore<Record<string, Card>>("loop:cards", {});

export function addCard(card: Omit<Card, "due" | "step" | "createdAt">, now = Date.now()) {
  cards.set((all) => (all[card.id] ? all : { ...all, [card.id]: { ...card, due: now + DAY, step: 0, createdAt: now } }));
}

export function removeCard(id: string) {
  cards.set((all) => {
    const next = { ...all };
    delete next[id];
    return next;
  });
}

export function gradeCard(id: string, grade: "again" | "good" | "easy", now = Date.now()) {
  cards.set((all) => {
    const c = all[id];
    if (!c) return all;
    const step = grade === "again" ? 0 : Math.min(c.step + (grade === "easy" ? 2 : 1), INTERVALS.length - 1);
    const due = grade === "again" ? now + 10 * 60 * 1000 : now + INTERVALS[step] * DAY;
    return { ...all, [id]: { ...c, step, due } };
  });
}

/** Turns a highlight into a cloze card: the most telling word is blanked out. */
export function clozeFromHighlight(text: string) {
  const words = text.match(/[A-Za-z][A-Za-z'-]{4,}/g) ?? [];
  const key = [...words].sort((a, b) => b.length - a.length)[0];
  if (!key) return { front: text, back: text };
  return { front: text.replace(key, "_____"), back: text };
}
