import { randArray, randInt, type CodeProblem } from "@/content/problem-types";

export const netStock: CodeProblem = {
  kind: "code",
  id: "net-stock",
  chapter: "prefix-sums",
  n: 2,
  title: "Stretches with an exact net change",
  level: "Medium",
  shape: "Prefix sums and a hash map",
  reference: { label: "LeetCode 560", url: "https://leetcode.com/problems/subarray-sum-equals-k/" },
  rounds: ["Coding round", "Onsite"],
  statement: `The pantry logs the net change in stock every minute: deliveries are positive, orders used are negative.

Given \`changes\` and a number \`k\`, return how many contiguous stretches of minutes have a net change of **exactly** \`k\`.`,
  params: ["changes", "k"],
  examples: [
    { args: [[1, 2, 3, -2, 2, 1], 3], output: 5 },
    { args: [[1, 1, 1], 2], output: 2 },
    { args: [[0, 0, 0], 0], output: 6, note: "Every stretch sums to 0." },
  ],
  constraints: ["1 ≤ changes.length ≤ 10⁶", "−1,000 ≤ changes[i] ≤ 1,000", "−10⁷ ≤ k ≤ 10⁷"],
  fn: { js: "exactStretches", py: "exact_stretches" },
  starter: {
    js: `function exactStretches(changes, k) {\n  // your code\n}\n`,
    py: `def exact_stretches(changes, k):\n    # your code\n    pass\n`,
  },
  solution: {
    js: `function exactStretches(changes, k) {
  const seen = new Map([[0, 1]]); // running total → how many times it occurred
  let total = 0;
  let count = 0;
  for (const c of changes) {
    total += c;
    count += seen.get(total - k) || 0; // stretches ending here with net k
    seen.set(total, (seen.get(total) || 0) + 1);
  }
  return count;
}`,
    py: `def exact_stretches(changes, k):
    seen = {0: 1}  # running total -> how many times it occurred
    total = count = 0
    for c in changes:
        total += c
        count += seen.get(total - k, 0)  # stretches ending here with net k
        seen[total] = seen.get(total, 0) + 1
    return count`,
  },
  brute: `function exactStretches(changes, k) {
  let count = 0;
  for (let i = 0; i < changes.length; i++) {
    let t = 0;
    for (let j = i; j < changes.length; j++) { t += changes[j]; if (t === k) count++; }
  }
  return count;
}`,
  edgeCases: [
    [[5], 5],
    [[5], 3],
    [[-1, -1, 1], 0],
    [[3, 4, 7, 2, -3, 1, 4, 2], 7],
  ],
  random: { count: 25, gen: (r) => [randArray(r, randInt(r, 1, 40), -4, 4), randInt(r, -5, 5)] },
  scale: {
    target: "O(n)",
    js: { n: "10⁶ minutes", limitMs: 1500, gen: (r) => [randArray(r, 1_000_000, -1_000, 1_000), 500] },
    py: { n: "2 × 10⁵ minutes", limitMs: 6000, gen: (r) => [randArray(r, 200_000, -1_000, 1_000), 500] },
  },
  hints: [
    "Negative changes break the sliding window here. Think about running totals instead.",
    "A stretch from i to j sums to k exactly when total(j) − total(i − 1) = k. So for each j, count earlier running totals equal to total(j) − k.",
    "seen = {0: 1}; total = 0. For c: total += c; count += seen[total − k]; seen[total] += 1.",
  ],
  walkthrough: {
    idea: "With negative values, shrinking a window can increase the sum, so a sliding window can't decide which edge to move. Running totals fix it: a stretch's sum is the difference of two running totals. Walking left to right, count how many earlier running totals equal the current one minus k, using a hash map of counts. Seeding it with 0 counts stretches that start at minute 0.",
    complexity: "O(n) time, O(n) space.",
    pitfalls: ["Forgetting to seed the map with {0: 1}.", "Updating the map before counting, which can pair a stretch with itself when k = 0.", "Reaching for a sliding window: it only works when all values are non-negative."],
    followUps: ["Longest stretch with net k (LeetCode 325, store first positions).", "Count stretches with sum divisible by k (LeetCode 974).", "2-D version: submatrices summing to a target."],
  },
};
