import { randArray, randInt, type CodeProblem, type Rand } from "@/content/problem-types";

function input(r: Rand, n: number, q: number): unknown[] {
  const sales = randArray(r, n, 0, 1_000);
  const queries = Array.from({ length: q }, () => {
    const a = randInt(r, 0, n - 1);
    const b = randInt(r, 0, n - 1);
    return [Math.min(a, b), Math.max(a, b)];
  });
  return [sales, queries];
}

export const rangeTotals: CodeProblem = {
  kind: "code",
  id: "range-totals",
  chapter: "prefix-sums",
  n: 1,
  title: "Sales between any two minutes",
  level: "Easy",
  shape: "Prefix sums",
  reference: { label: "LeetCode 303", url: "https://leetcode.com/problems/range-sum-query-immutable/" },
  rounds: ["Phone screen", "Coding round"],
  statement: `The analytics dashboard lets managers ask "how much did we sell between minute \`l\` and minute \`r\`?" many times a day, for the same day's data.

Given \`sales\` for each minute and a list of \`queries\`, each \`[l, r]\` with both ends included, return the total for every query, in order.`,
  params: ["sales", "queries"],
  examples: [
    { args: [[5, 3, 8, 1, 4], [[0, 2], [1, 3], [4, 4]]], output: [16, 12, 4] },
    { args: [[7], [[0, 0]]], output: [7] },
  ],
  constraints: ["1 ≤ sales.length ≤ 2 × 10⁵", "1 ≤ queries.length ≤ 2 × 10⁵", "0 ≤ sales[i] ≤ 1,000", "0 ≤ l ≤ r < sales.length"],
  fn: { js: "rangeTotals", py: "range_totals" },
  starter: {
    js: `function rangeTotals(sales, queries) {\n  // your code\n}\n`,
    py: `def range_totals(sales, queries):\n    # your code\n    pass\n`,
  },
  solution: {
    js: `function rangeTotals(sales, queries) {
  const prefix = [0]; // prefix[i] = total of the first i minutes
  for (const s of sales) prefix.push(prefix[prefix.length - 1] + s);
  return queries.map(([l, r]) => prefix[r + 1] - prefix[l]);
}`,
    py: `def range_totals(sales, queries):
    prefix = [0]  # prefix[i] = total of the first i minutes
    for s in sales:
        prefix.append(prefix[-1] + s)
    return [prefix[r + 1] - prefix[l] for l, r in queries]`,
  },
  brute: `function rangeTotals(sales, queries) {
  return queries.map(([l, r]) => {
    let t = 0;
    for (let i = l; i <= r; i++) t += sales[i];
    return t;
  });
}`,
  edgeCases: [
    [[1, 2, 3], [[0, 2], [0, 0], [2, 2]]],
    [[0, 0, 0], [[0, 2]]],
  ],
  random: { count: 25, gen: (r) => input(r, randInt(r, 1, 30), randInt(r, 1, 10)) },
  scale: {
    target: "O(n + q)",
    js: { n: "2 × 10⁵ minutes and 2 × 10⁵ queries", limitMs: 1500, gen: (r) => input(r, 200_000, 200_000) },
    py: { n: "5 × 10⁴ minutes and 5 × 10⁴ queries", limitMs: 6000, gen: (r) => input(r, 50_000, 50_000) },
  },
  hints: [
    "Every query re-adds numbers that earlier queries already added.",
    "Precompute running totals once. The total from l to r is a difference of two running totals.",
    "prefix[0] = 0; prefix[i + 1] = prefix[i] + sales[i]. Answer = prefix[r + 1] − prefix[l].",
  ],
  walkthrough: {
    idea: "Summing each range directly costs up to n per query, O(n·q) in total. Running totals turn any range into one subtraction: everything up to r, minus everything before l. Build them once in O(n), then answer each query in O(1).",
    complexity: "O(n + q) time, O(n) space.",
    pitfalls: ["Off by one: use prefix[r + 1] − prefix[l] with a leading 0.", "Rebuilding the prefix array per query.", "Overflow in fixed-width languages with large totals."],
    followUps: ["Values change between queries: Fenwick or segment tree (chapter 33).", "2-D grid of sales (LeetCode 304).", "Many range additions, then read the final array: difference arrays."],
  },
};
