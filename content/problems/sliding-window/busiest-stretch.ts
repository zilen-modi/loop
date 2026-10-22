import { randArray, randInt, type CodeProblem } from "@/content/problem-types";

export const busiestStretch: CodeProblem = {
  kind: "code",
  id: "busiest-stretch",
  chapter: "sliding-window",
  n: 1,
  title: "Busiest stretch",
  level: "Easy",
  shape: "Fixed window",
  reference: { label: "LeetCode 643", url: "https://leetcode.com/problems/maximum-average-subarray-i/" },
  rounds: ["Phone screen", "Coding round"],
  statement: `Tiffin logs how many orders arrive each minute. Surge pricing looks at the busiest stretch of **k consecutive minutes**.

Given \`orders\`, the order count for each minute in order, and a window length \`k\`, return the largest total number of orders in any \`k\` consecutive minutes.`,
  params: ["orders", "k"],
  examples: [
    { args: [[4, 9, 3, 8, 6, 2, 7], 3], output: 20, note: "Minutes 2–4 have 9 + 3 + 8 = 20 orders." },
    { args: [[5], 1], output: 5 },
    { args: [[0, 0, 0], 2], output: 0 },
  ],
  constraints: ["1 ≤ k ≤ orders.length ≤ 10⁶", "0 ≤ orders[i] ≤ 10⁴"],
  fn: { js: "busiestStretch", py: "busiest_stretch" },
  starter: {
    js: `function busiestStretch(orders, k) {\n  // your code\n}\n`,
    py: `def busiest_stretch(orders, k):\n    # your code\n    pass\n`,
  },
  solution: {
    js: `function busiestStretch(orders, k) {
  let window = 0;
  for (let i = 0; i < k; i++) window += orders[i];
  let best = window;
  for (let i = k; i < orders.length; i++) {
    window += orders[i] - orders[i - k]; // newest minute in, oldest out
    if (window > best) best = window;
  }
  return best;
}`,
    py: `def busiest_stretch(orders, k):
    window = sum(orders[:k])
    best = window
    for i in range(k, len(orders)):
        window += orders[i] - orders[i - k]  # newest minute in, oldest out
        best = max(best, window)
    return best`,
  },
  brute: `function busiestStretch(orders, k) {
  let best = -Infinity;
  for (let start = 0; start + k <= orders.length; start++) {
    let sum = 0;
    for (let i = start; i < start + k; i++) sum += orders[i];
    best = Math.max(best, sum);
  }
  return best;
}`,
  edgeCases: [
    [[7, 1, 2], 3],
    [[1, 2, 3, 4], 1],
    [[10, 0, 0, 0, 10], 2],
    [[3, 3, 3, 3], 4],
  ],
  random: {
    count: 25,
    gen: (r) => {
      const n = randInt(r, 1, 40);
      return [randArray(r, n, 0, 50), randInt(r, 1, n)];
    },
  },
  scale: {
    target: "O(n)",
    js: { n: "10⁶ minutes, k = 20,000", limitMs: 1500, gen: (r) => [randArray(r, 1_000_000, 0, 10_000), 20_000] },
    py: { n: "2 × 10⁵ minutes, k = 2,000", limitMs: 6000, gen: (r) => [randArray(r, 200_000, 0, 10_000), 2_000] },
  },
  hints: [
    "Two neighbouring windows share all but one minute on each end.",
    "Keep a running total. Moving the window one step right adds one value and removes one value.",
    "sum = first k values; best = sum. For i from k to n − 1: sum += a[i] − a[i − k]; best = max(best, sum).",
  ],
  walkthrough: {
    idea: "Recounting every window costs k work per window, so O(n·k) overall. A window that moves one step keeps k − 1 of its values. Add the value that enters and subtract the value that leaves, and each step costs O(1).",
    complexity: "O(n) time, O(1) extra space.",
    pitfalls: ["Starting `best` at 0 is fine here because counts are non-negative, but use the first window (or −∞) when values can be negative.", "Subtract `orders[i - k]`, not `orders[i - k + 1]`: the window ending at i starts at i − k + 1, so the one leaving is i − k."],
    followUps: ["Return the start minute as well as the total.", "Average instead of total (LeetCode 643).", "What if k changes per query? Precompute prefix sums for O(1) per query."],
  },
};
