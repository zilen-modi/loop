import meta from "./leetcode-meta.json";

// Top coding questions: the classic 75 (from the widely shared "Blind 75" list) plus 16 that are
// commonly practised alongside it. Numbers, titles, difficulty and premium flags come from LeetCode's
// public API via scripts/fetch-leetcode-meta.mjs, not from memory.

export type DsaQuestion = {
  slug: string;
  pattern: string;
  id: number;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  premium: boolean;
  classic: boolean;
};

export const dsaQuestions = meta as DsaQuestion[];

/** Which Loop chapter teaches each pattern (book 1). */
export const patternChapter: Record<string, number> = {
  "Arrays and hashing": 3,
  "Two pointers": 8,
  "Sliding window": 9,
  Stack: 12,
  "Binary search": 11,
  "Linked list": 14,
  Trees: 18,
  Tries: 21,
  Heaps: 20,
  Backtracking: 27,
  Graphs: 22,
  Intervals: 15,
  "Dynamic programming": 29,
  Greedy: 28,
  Matrix: 16,
  "Bit manipulation": 6,
};

export const dsaPatterns = [...new Set(dsaQuestions.map((q) => q.pattern))];

export const dsaSources = {
  fetched: "22 October 2026",
  list: { label: "Tech Interview Handbook: the Blind 75 and best-practice questions", href: "https://www.techinterviewhandbook.org/best-practice-questions/" },
};
