import { randInt, type CodeProblem, type Rand } from "@/content/problem-types";

const dishNames = ["dal", "roti", "rice", "paneer", "idli", "dosa", "poha", "khichdi", "biryani", "rajma", "chole", "upma"];
const randomDishes = (r: Rand, n: number, variety: number) => Array.from({ length: n }, () => dishNames[randInt(r, 0, variety - 1)]);
const periodic = (n: number, period: number) => Array.from({ length: n }, (_, i) => `dish${i % period}`);

export const uniqueDishes: CodeProblem = {
  kind: "code",
  id: "unique-dishes",
  chapter: "sliding-window",
  n: 3,
  title: "Longest run without a repeat dish",
  level: "Medium",
  shape: "Variable window and a set",
  reference: { label: "LeetCode 3", url: "https://leetcode.com/problems/longest-substring-without-repeating-characters/" },
  rounds: ["Phone screen", "Coding round"],
  statement: `A cloud kitchen wants to show off its variety. Given \`dishes\`, the dish of each order in the order they were placed, return the length of the longest run of **consecutive** orders in which no dish appears twice.`,
  params: ["dishes"],
  examples: [
    { args: [["dal", "roti", "dal", "rice", "roti", "paneer"]], output: 4, note: "dal, rice, roti, paneer." },
    { args: [["idli", "idli", "idli"]], output: 1 },
    { args: [[]], output: 0 },
  ],
  constraints: ["0 ≤ dishes.length ≤ 10⁶", "Dish names are short lowercase strings"],
  fn: { js: "longestUniqueRun", py: "longest_unique_run" },
  starter: {
    js: `function longestUniqueRun(dishes) {\n  // your code\n}\n`,
    py: `def longest_unique_run(dishes):\n    # your code\n    pass\n`,
  },
  solution: {
    js: `function longestUniqueRun(dishes) {
  const lastSeen = new Map();
  let left = 0;
  let best = 0;
  for (let right = 0; right < dishes.length; right++) {
    const dish = dishes[right];
    // Jump the left edge past the previous copy, but never move it backwards.
    if (lastSeen.has(dish) && lastSeen.get(dish) >= left) left = lastSeen.get(dish) + 1;
    lastSeen.set(dish, right);
    best = Math.max(best, right - left + 1);
  }
  return best;
}`,
    py: `def longest_unique_run(dishes):
    last_seen = {}
    left = 0
    best = 0
    for right, dish in enumerate(dishes):
        # Jump the left edge past the previous copy, but never move it backwards.
        if last_seen.get(dish, -1) >= left:
            left = last_seen[dish] + 1
        last_seen[dish] = right
        best = max(best, right - left + 1)
    return best`,
  },
  brute: `function longestUniqueRun(dishes) {
  let best = 0;
  for (let start = 0; start < dishes.length; start++) {
    const seen = new Set();
    for (let i = start; i < dishes.length && !seen.has(dishes[i]); i++) seen.add(dishes[i]);
    best = Math.max(best, seen.size);
  }
  return best;
}`,
  edgeCases: [
    [["dal"]],
    [["dal", "roti", "rice"]],
    [["dal", "roti", "roti", "dal"]],
    [["a", "b", "c", "a", "b", "c", "b", "b"]],
  ],
  random: {
    count: 25,
    gen: (r) => [randomDishes(r, randInt(r, 0, 40), randInt(r, 1, dishNames.length))],
  },
  scale: {
    target: "O(n)",
    js: { n: "10⁶ orders, runs of 20,000", limitMs: 1500, gen: () => [periodic(1_000_000, 20_000)] },
    py: { n: "2 × 10⁵ orders, runs of 5,000", limitMs: 6000, gen: () => [periodic(200_000, 5_000)] },
  },
  hints: [
    "When a dish repeats inside your run, everything up to its first copy has to go.",
    "Keep a window [left, right]. Remember where each dish was last seen; on a repeat, move left just past that position.",
    "for right: if lastSeen[dish] ≥ left: left = lastSeen[dish] + 1. lastSeen[dish] = right. best = max(best, right − left + 1).",
  ],
  walkthrough: {
    idea: "Restarting from every position re-reads the same orders many times. Instead, grow the window to the right and only move its left edge forward when a dish repeats. Storing where each dish was last seen lets the left edge jump straight past the old copy.",
    complexity: "O(n) time, O(d) space for d different dishes.",
    pitfalls: ["Moving `left` backwards: a dish seen before the current window must be ignored, hence `>= left`.", "Using a set and shrinking one step at a time also works (O(n) amortised), but the jump avoids the inner loop."],
    followUps: ["At most two repeats allowed (LeetCode 159/340 shape).", "Return the run itself, not just its length.", "Stream of orders that never ends: keep the map bounded."],
  },
};
