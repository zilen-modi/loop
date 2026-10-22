import { randInt, type CodeProblem, type Rand } from "@/content/problem-types";

/** Random prices with exactly one pair summing to the target (rejection sampling on small inputs). */
function uniquePair(r: Rand): unknown[] {
  for (;;) {
    const n = randInt(r, 2, 30);
    const prices = Array.from({ length: n }, () => randInt(r, 1, 200));
    const i = randInt(r, 0, n - 2);
    const j = randInt(r, i + 1, n - 1);
    const target = prices[i] + prices[j];
    let pairs = 0;
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) if (prices[a] + prices[b] === target) pairs++;
    if (pairs === 1) return [prices, target];
  }
}

/** Large input with exactly one valid pair: every other price is a multiple of 4. */
function bigUniquePair(r: Rand, n: number): unknown[] {
  const prices = Array.from({ length: n }, () => 4 * randInt(r, 1, 50_000_000));
  const i = randInt(r, 0, n - 2);
  const j = randInt(r, i + 1, n - 1);
  prices[i] = 4 * randInt(r, 1, 50_000_000) + 1;
  prices[j] = 4 * randInt(r, 1, 50_000_000) + 2;
  return [prices, prices[i] + prices[j]];
}

export const pairForBill: CodeProblem = {
  kind: "code",
  id: "pair-for-bill",
  chapter: "hashing",
  n: 1,
  title: "Two items that make the bill",
  level: "Easy",
  shape: "Hash map of what you've seen",
  reference: { label: "LeetCode 1", url: "https://leetcode.com/problems/two-sum/" },
  rounds: ["Phone screen", "Coding round"],
  statement: `A customer's gift voucher is worth exactly \`target\` rupees and must be spent on **two different items** from the menu.

Given \`prices\` (the menu, in order) and \`target\`, return \`[i, j]\` with \`i < j\`, the positions of the two items whose prices add up to \`target\`. There is always exactly one such pair.`,
  params: ["prices", "target"],
  examples: [
    { args: [[120, 45, 80, 35], 125], output: [1, 2], note: "45 + 80 = 125." },
    { args: [[60, 60], 120], output: [0, 1], note: "Two different items can have the same price." },
    { args: [[10, 25, 40, 75, 90], 130], output: [2, 4] },
  ],
  constraints: ["2 ≤ prices.length ≤ 10⁶", "1 ≤ prices[i] ≤ 2 × 10⁸", "Exactly one valid pair exists"],
  fn: { js: "pairForBill", py: "pair_for_bill" },
  starter: {
    js: `function pairForBill(prices, target) {\n  // your code\n}\n`,
    py: `def pair_for_bill(prices, target):\n    # your code\n    pass\n`,
  },
  solution: {
    js: `function pairForBill(prices, target) {
  const seen = new Map(); // price → position
  for (let j = 0; j < prices.length; j++) {
    const need = target - prices[j];
    if (seen.has(need)) return [seen.get(need), j];
    seen.set(prices[j], j);
  }
  return [];
}`,
    py: `def pair_for_bill(prices, target):
    seen = {}  # price -> position
    for j, price in enumerate(prices):
        need = target - price
        if need in seen:
            return [seen[need], j]
        seen[price] = j
    return []`,
  },
  brute: `function pairForBill(prices, target) {
  for (let i = 0; i < prices.length; i++)
    for (let j = i + 1; j < prices.length; j++)
      if (prices[i] + prices[j] === target) return [i, j];
  return [];
}`,
  edgeCases: [
    [[1, 2], 3],
    [[5, 1, 5], 10],
    [[3, 2, 4], 6],
  ],
  random: { count: 25, gen: uniquePair },
  scale: {
    target: "O(n)",
    js: { n: "10⁶ menu items", limitMs: 1500, gen: (r) => bigUniquePair(r, 1_000_000) },
    py: { n: "2 × 10⁵ menu items", limitMs: 6000, gen: (r) => bigUniquePair(r, 200_000) },
  },
  hints: [
    "For each price, you know exactly which other price would complete the bill.",
    "Walk the menu once. Before storing a price, check whether its partner (target − price) is already stored.",
    "seen = {}. For j: need = target − p[j]; if need in seen: return [seen[need], j]; seen[p[j]] = j.",
  ],
  walkthrough: {
    idea: "Checking every pair is O(n²). But for any price p, the only partner that works is target − p, so the question becomes 'have I already seen that value?', which a hash map answers in O(1). Checking before storing also handles two items with the same price.",
    complexity: "O(n) time, O(n) space.",
    pitfalls: ["Storing before checking pairs an item with itself when price × 2 = target.", "Returning values instead of positions.", "Sorting first loses the original positions (and costs O(n log n))."],
    followUps: ["The menu is sorted: use two pointers for O(1) space (LeetCode 167).", "Return every pair, without duplicates.", "Three items instead of two (LeetCode 15)."],
  },
};
