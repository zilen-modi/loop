import { randArray, randInt, type CodeProblem } from "@/content/problem-types";

export const rooftopRain: CodeProblem = {
  kind: "code",
  id: "rooftop-rain",
  chapter: "two-pointers",
  n: 4,
  title: "Rain on the rooftop kitchen",
  level: "Hard",
  shape: "Two pointers with running maxima",
  reference: { label: "LeetCode 42", url: "https://leetcode.com/problems/trapping-rain-water/" },
  rounds: ["Coding round", "Onsite"],
  statement: `The rooftop kitchen's roof is a row of unit-wide blocks of different heights. After a monsoon shower, water collects in the dips: above each block, water rises to the **lower** of the tallest block somewhere to its left and the tallest block somewhere to its right.

Given \`heights\`, return how many units of water stay on the roof.`,
  params: ["heights"],
  examples: [
    { args: [[0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]], output: 6 },
    { args: [[4, 2, 0, 3, 2, 5]], output: 9 },
    { args: [[3]], output: 0 },
  ],
  constraints: ["1 ≤ heights.length ≤ 10⁶", "0 ≤ heights[i] ≤ 10⁵"],
  fn: { js: "waterOnRoof", py: "water_on_roof" },
  starter: {
    js: `function waterOnRoof(heights) {\n  // your code\n}\n`,
    py: `def water_on_roof(heights):\n    # your code\n    pass\n`,
  },
  solution: {
    js: `function waterOnRoof(heights) {
  let i = 0;
  let j = heights.length - 1;
  let leftMax = 0;
  let rightMax = 0;
  let water = 0;
  while (i < j) {
    // The lower side decides the water level, and its running maximum is all we need.
    if (heights[i] < heights[j]) {
      leftMax = Math.max(leftMax, heights[i]);
      water += leftMax - heights[i];
      i++;
    } else {
      rightMax = Math.max(rightMax, heights[j]);
      water += rightMax - heights[j];
      j--;
    }
  }
  return water;
}`,
    py: `def water_on_roof(heights):
    i, j = 0, len(heights) - 1
    left_max = right_max = water = 0
    while i < j:
        # The lower side decides the water level, and its running maximum is all we need.
        if heights[i] < heights[j]:
            left_max = max(left_max, heights[i])
            water += left_max - heights[i]
            i += 1
        else:
            right_max = max(right_max, heights[j])
            water += right_max - heights[j]
            j -= 1
    return water`,
  },
  brute: `function waterOnRoof(heights) {
  let water = 0;
  for (let k = 0; k < heights.length; k++) {
    let left = 0, right = 0;
    for (let a = 0; a <= k; a++) left = Math.max(left, heights[a]);
    for (let b = k; b < heights.length; b++) right = Math.max(right, heights[b]);
    water += Math.min(left, right) - heights[k];
  }
  return water;
}`,
  edgeCases: [[[1, 2, 3]], [[3, 2, 1]], [[2, 0, 2]], [[5, 0, 0, 0, 0, 1]]],
  random: { count: 25, gen: (r) => [randArray(r, randInt(r, 1, 40), 0, 12)] },
  scale: {
    target: "O(n)",
    js: { n: "10⁶ blocks", limitMs: 1500, gen: (r) => [randArray(r, 1_000_000, 0, 100_000)] },
    py: { n: "2 × 10⁵ blocks", limitMs: 6000, gen: (r) => [randArray(r, 200_000, 0, 100_000)] },
  },
  hints: [
    "Water above a block depends on two numbers: the tallest block to its left and the tallest to its right.",
    "Precompute both maxima in two passes (O(n) space), or walk two pointers inward keeping a running max on each side.",
    "i, j at the ends. If h[i] < h[j]: leftMax = max(leftMax, h[i]); water += leftMax − h[i]; i++. Else do the same on the right with rightMax.",
  ],
  walkthrough: {
    idea: "For each block, scanning both sides for the tallest is O(n²). Precomputing prefix and suffix maxima gives O(n) with O(n) space. Two pointers do it in O(1) space: whichever end is lower, its water level is fixed by its own running maximum, because the other side is already known to be at least as tall.",
    complexity: "O(n) time, O(1) space.",
    pitfalls: ["Adding water at the two outermost blocks (it always spills).", "Comparing running maxima instead of current heights when deciding which side to move; both work if done consistently, mixing them breaks it.", "Negative water from subtracting in the wrong order."],
    followUps: ["The roof is a 2-D grid (LeetCode 407) needs a heap.", "Explain the prefix/suffix-maximum version first, then optimise space.", "Return the water above each block."],
  },
};
