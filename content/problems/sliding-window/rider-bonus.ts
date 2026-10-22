import { randArray, randInt, type CodeProblem } from "@/content/problem-types";

export const riderBonus: CodeProblem = {
  kind: "code",
  id: "rider-bonus",
  chapter: "sliding-window",
  n: 2,
  title: "Rider bonus from both ends",
  level: "Medium",
  shape: "Window on the complement",
  reference: { label: "LeetCode 1423", url: "https://leetcode.com/problems/maximum-points-you-can-obtain-from-cards/" },
  rounds: ["Coding round"],
  statement: `A delivery route is a line of stops, and each stop pays a bonus. A rider claims exactly \`k\` stops, one at a time, and each claim must be the **first or the last** stop still left on the route.

Given \`bonuses\` for the stops in route order and \`k\`, return the largest total bonus the rider can collect.`,
  params: ["bonuses", "k"],
  examples: [
    { args: [[1, 2, 3, 4, 5, 6, 1], 3], output: 12, note: "Claim the last three stops: 1 + 6 + 5." },
    { args: [[2, 2, 2], 2], output: 4 },
    { args: [[9, 7, 7, 9, 7, 7, 9], 7], output: 55, note: "Claiming every stop takes them all." },
  ],
  constraints: ["1 ≤ k ≤ bonuses.length ≤ 10⁶", "1 ≤ bonuses[i] ≤ 10⁴"],
  fn: { js: "bestBonus", py: "best_bonus" },
  starter: {
    js: `function bestBonus(bonuses, k) {\n  // your code\n}\n`,
    py: `def best_bonus(bonuses, k):\n    # your code\n    pass\n`,
  },
  solution: {
    js: `function bestBonus(bonuses, k) {
  const n = bonuses.length;
  const keep = n - k; // the stops left behind always form one contiguous block
  let total = 0;
  for (const b of bonuses) total += b;
  if (keep === 0) return total;
  let window = 0;
  for (let i = 0; i < keep; i++) window += bonuses[i];
  let smallest = window;
  for (let i = keep; i < n; i++) {
    window += bonuses[i] - bonuses[i - keep];
    if (window < smallest) smallest = window;
  }
  return total - smallest;
}`,
    py: `def best_bonus(bonuses, k):
    n = len(bonuses)
    keep = n - k  # the stops left behind always form one contiguous block
    total = sum(bonuses)
    if keep == 0:
        return total
    window = sum(bonuses[:keep])
    smallest = window
    for i in range(keep, n):
        window += bonuses[i] - bonuses[i - keep]
        smallest = min(smallest, window)
    return total - smallest`,
  },
  brute: `function bestBonus(bonuses, k) {
  const n = bonuses.length;
  let best = 0;
  for (let fromStart = 0; fromStart <= k; fromStart++) {
    let sum = 0;
    for (let i = 0; i < fromStart; i++) sum += bonuses[i];
    for (let i = 0; i < k - fromStart; i++) sum += bonuses[n - 1 - i];
    best = Math.max(best, sum);
  }
  return best;
}`,
  edgeCases: [
    [[1, 1000, 1], 1],
    [[5], 1],
    [[1, 2, 3], 3],
    [[100, 40, 17, 9, 73, 75], 3],
    [[1, 79, 80, 1, 1, 1, 200, 1], 3],
  ],
  random: {
    count: 25,
    gen: (r) => {
      const n = randInt(r, 1, 40);
      return [randArray(r, n, 1, 60), randInt(r, 1, n)];
    },
  },
  scale: {
    target: "O(n)",
    js: { n: "10⁶ stops, k = 6 × 10⁵", limitMs: 1500, gen: (r) => [randArray(r, 1_000_000, 1, 10_000), 600_000] },
    py: { n: "2 × 10⁵ stops, k = 1.2 × 10⁵", limitMs: 6000, gen: (r) => [randArray(r, 200_000, 1, 10_000), 120_000] },
  },
  hints: [
    "Whatever the rider takes from the two ends, the stops they leave behind sit together in the middle.",
    "Maximising what you take is the same as minimising what you leave. The leftover is a window of exactly n − k stops.",
    "total = sum(all). Slide a window of size n − k and track its smallest sum. Answer = total − smallest. If k = n, the answer is total.",
  ],
  walkthrough: {
    idea: "Trying every split between the front and the back recomputes sums again and again. Flip the question instead: the unclaimed stops are always one contiguous block of n − k stops in the middle. The best claim leaves behind the cheapest such block, which a fixed sliding window finds in one pass.",
    complexity: "O(n) time, O(1) extra space. (Prefix sums over the k + 1 splits also give O(k).)",
    pitfalls: ["Forgetting k = n, where the window to leave behind is empty.", "Greedily taking the larger end each time fails: on [1, 79, 80, 1, 1, 1, 200, 1] with k = 3 it collects 1 + 79 + 80 = 160, but the last three stops give 202."],
    followUps: ["Return which stops to claim.", "What if each end has its own limit?", "Minimum instead of maximum: same trick, track the largest leftover."],
  },
};
