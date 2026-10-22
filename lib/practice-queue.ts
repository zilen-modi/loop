"use client";

// A mixed practice set is a shuffled queue of problem ids kept for the browser session.
const KEY = "loop:mixed-queue";

export function startQueue(ids: string[]) {
  const q = [...ids];
  for (let i = q.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [q[i], q[j]] = [q[j], q[i]];
  }
  try {
    sessionStorage.setItem(KEY, JSON.stringify(q));
  } catch {}
  return q;
}

export function nextInQueue(current: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const q: string[] = JSON.parse(sessionStorage.getItem(KEY) || "[]");
    const i = q.indexOf(current);
    const next = i >= 0 ? q[i + 1] : undefined;
    return next ? `/problems/${next}?mode=mixed&from=${encodeURIComponent("/practice")}` : "/practice";
  } catch {
    return undefined;
  }
}
