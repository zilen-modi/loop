import { randArray, randInt, type CodeProblem } from "@/content/problem-types";

export const widestBay: CodeProblem = {
  kind: "code",
  id: "widest-bay",
  chapter: "two-pointers",
  n: 2,
  title: "Biggest loading bay",
  level: "Medium",
  shape: "Move the shorter side inwards",
  reference: { label: "LeetCode 11", url: "https://leetcode.com/problems/container-with-most-water/" },
  rounds: ["Coding round"],
  statement: `A warehouse has a row of upright partitions, one metre apart. Any two partitions can form a loading bay: its width is the distance between them, and crates can be stacked only as high as the **shorter** of the two.

Given \`heights\` of the partitions in order, return the largest possible bay area (width × usable height).`,
  params: ["heights"],
  examples: [
    { args: [[1, 8, 6, 2, 5, 4, 8, 3, 7]], output: 49, note: "Partitions 1 and 8: width 7, height min(8, 7) = 7." },
    { args: [[1, 1]], output: 1 },
    { args: [[4, 3, 2, 1, 4]], output: 16 },
  ],
  constraints: ["2 ≤ heights.length ≤ 10⁶", "0 ≤ heights[i] ≤ 10⁴"],
  fn: { js: "biggestBay", py: "biggest_bay" },
  starter: {
    js: `function biggestBay(heights) {\n  // your code\n}\n`,
    py: `def biggest_bay(heights):\n    # your code\n    pass\n`,
  },
  solution: {
    js: `function biggestBay(heights) {
  let i = 0;
  let j = heights.length - 1;
  let best = 0;
  while (i < j) {
    best = Math.max(best, (j - i) * Math.min(heights[i], heights[j]));
    // The shorter side limits every narrower bay it's part of, so move it.
    if (heights[i] < heights[j]) i++;
    else j--;
  }
  return best;
}`,
    py: `def biggest_bay(heights):
    i, j = 0, len(heights) - 1
    best = 0
    while i < j:
        best = max(best, (j - i) * min(heights[i], heights[j]))
        # The shorter side limits every narrower bay it's part of, so move it.
        if heights[i] < heights[j]:
            i += 1
        else:
            j -= 1
    return best`,
  },
  brute: `function biggestBay(heights) {
  let best = 0;
  for (let i = 0; i < heights.length; i++)
    for (let j = i + 1; j < heights.length; j++)
      best = Math.max(best, (j - i) * Math.min(heights[i], heights[j]));
  return best;
}`,
  edgeCases: [[[0, 0]], [[5, 0, 0, 0, 5]], [[1, 2, 3, 4, 5]], [[10, 1, 1, 1, 1, 1, 1, 10]]],
  random: { count: 25, gen: (r) => [randArray(r, randInt(r, 2, 40), 0, 30)] },
  scale: {
    target: "O(n)",
    js: { n: "10⁶ partitions", limitMs: 1500, gen: (r) => [randArray(r, 1_000_000, 0, 10_000)] },
    py: { n: "2 × 10⁵ partitions", limitMs: 6000, gen: (r) => [randArray(r, 200_000, 0, 10_000)] },
  },
  hints: [
    "Start with the widest bay possible. What would have to change for a narrower bay to beat it?",
    "Put pointers at both ends. The shorter partition caps the height of every narrower bay that uses it, so it can be discarded: move it inwards.",
    "i = 0, j = n − 1. While i < j: best = max(best, (j − i) · min(h[i], h[j])); move whichever of h[i], h[j] is smaller.",
  ],
  walkthrough: {
    idea: "Every pair is O(n²). Start with the widest pair. Any narrower bay that keeps the shorter partition has less width and no more height, so it can't win: drop the shorter side and move inward. Each step discards one partition for good.",
    complexity: "O(n) time, O(1) space.",
    pitfalls: ["Moving the taller side instead of the shorter.", "Using the taller height in the area.", "Width is j − i, not j − i + 1."],
    followUps: ["Trapping rain water (LeetCode 42) looks similar but sums water over every position.", "Return which two partitions.", "Partitions can be removed: how does the answer change?"],
  },
};
