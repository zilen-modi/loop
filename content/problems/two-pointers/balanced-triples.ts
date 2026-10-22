import { randArray, randInt, type CodeProblem } from "@/content/problem-types";

export const balancedTriples: CodeProblem = {
  kind: "code",
  id: "balanced-triples",
  chapter: "two-pointers",
  n: 3,
  title: "Three adjustments that cancel out",
  level: "Medium",
  shape: "Sort, fix one, two pointers",
  reference: { label: "LeetCode 15", url: "https://leetcode.com/problems/3sum/" },
  rounds: ["Phone screen", "Coding round"],
  statement: `At the end of the day, finance reviews price adjustments (positive or negative, in rupees). They want every way to pick **three** adjustments that cancel out exactly, adding up to zero.

Given \`adjustments\`, return every distinct triple of values \`[a, b, c]\` with \`a + b + c = 0\`, using three different positions. List each triple in ascending order, list the triples in ascending order, and don't repeat a triple.`,
  params: ["adjustments"],
  examples: [
    { args: [[-1, 0, 1, 2, -1, -4]], output: [[-1, -1, 2], [-1, 0, 1]] },
    { args: [[0, 1, 1]], output: [] },
    { args: [[0, 0, 0, 0]], output: [[0, 0, 0]] },
  ],
  constraints: ["3 ≤ adjustments.length ≤ 3,000", "−10⁵ ≤ adjustments[i] ≤ 10⁵"],
  fn: { js: "cancellingTriples", py: "cancelling_triples" },
  starter: {
    js: `function cancellingTriples(adjustments) {\n  // your code\n}\n`,
    py: `def cancelling_triples(adjustments):\n    # your code\n    pass\n`,
  },
  solution: {
    js: `function cancellingTriples(adjustments) {
  const a = [...adjustments].sort((x, y) => x - y);
  const out = [];
  for (let i = 0; i < a.length - 2; i++) {
    if (i > 0 && a[i] === a[i - 1]) continue; // same first value, same triples
    let lo = i + 1;
    let hi = a.length - 1;
    while (lo < hi) {
      const sum = a[i] + a[lo] + a[hi];
      if (sum < 0) lo++;
      else if (sum > 0) hi--;
      else {
        out.push([a[i], a[lo], a[hi]]);
        lo++;
        hi--;
        while (lo < hi && a[lo] === a[lo - 1]) lo++;
        while (lo < hi && a[hi] === a[hi + 1]) hi--;
      }
    }
  }
  return out;
}`,
    py: `def cancelling_triples(adjustments):
    a = sorted(adjustments)
    out = []
    for i in range(len(a) - 2):
        if i > 0 and a[i] == a[i - 1]:
            continue  # same first value, same triples
        lo, hi = i + 1, len(a) - 1
        while lo < hi:
            s = a[i] + a[lo] + a[hi]
            if s < 0:
                lo += 1
            elif s > 0:
                hi -= 1
            else:
                out.append([a[i], a[lo], a[hi]])
                lo += 1
                hi -= 1
                while lo < hi and a[lo] == a[lo - 1]:
                    lo += 1
                while lo < hi and a[hi] == a[hi + 1]:
                    hi -= 1
    return out`,
  },
  brute: `function cancellingTriples(adjustments) {
  const a = [...adjustments].sort((x, y) => x - y);
  const seen = new Set();
  const out = [];
  for (let i = 0; i < a.length; i++)
    for (let j = i + 1; j < a.length; j++)
      for (let k = j + 1; k < a.length; k++)
        if (a[i] + a[j] + a[k] === 0) {
          const key = a[i] + "," + a[j] + "," + a[k];
          if (!seen.has(key)) { seen.add(key); out.push([a[i], a[j], a[k]]); }
        }
  return out.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
}`,
  edgeCases: [[[1, 2, 3]], [[-2, 0, 1, 1, 2]], [[3, 0, -3, 3, -3, 0]], [[-1, -1, -1, 2, 2]]],
  random: { count: 25, gen: (r) => [randArray(r, randInt(r, 3, 30), -8, 8)] },
  scale: {
    target: "O(n²)",
    js: { n: "3,000 adjustments", limitMs: 1500, gen: (r) => [randArray(r, 3_000, -3_000, 3_000)] },
    py: { n: "1,500 adjustments", limitMs: 8000, gen: (r) => [randArray(r, 1_500, -1_500, 1_500)] },
  },
  hints: [
    "If you fix the first value, you're left with a familiar problem: two values that add to a target.",
    "Sort first. For each first value, find pairs in the rest with two pointers. Skip repeated values to avoid duplicate triples.",
    "Sort a. For i: skip if a[i] == a[i−1]. lo = i + 1, hi = n − 1; move lo up if the sum is too small, hi down if too big; on a hit, record and skip duplicates on both sides.",
  ],
  walkthrough: {
    idea: "Three nested loops are O(n³). After sorting, fixing the first value turns the rest into 'two values that sum to −a[i]' on a sorted range, which two pointers solve in O(n). Sorting also makes duplicates adjacent, so skipping equal neighbours keeps triples unique without a set.",
    complexity: "O(n²) time, O(1) extra space beyond the output (plus the sort).",
    pitfalls: ["Duplicate triples when the same value appears several times.", "Skipping duplicates before recording the first hit.", "Using a hash set of triples works but hides the O(n²) structure interviewers want to hear."],
    followUps: ["Closest sum to a target (LeetCode 16).", "Four values (LeetCode 18).", "Count triples with sum below a target."],
  },
};
