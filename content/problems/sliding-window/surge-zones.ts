import { randArray, randInt, type CodeProblem } from "@/content/problem-types";

export const surgeZones: CodeProblem = {
  kind: "code",
  id: "surge-zones",
  chapter: "sliding-window",
  n: 4,
  title: "Calmest long stretch",
  level: "Medium",
  shape: "Variable window and a counter",
  reference: { label: "LeetCode 1004", url: "https://leetcode.com/problems/max-consecutive-ones-iii/" },
  rounds: ["Coding round"],
  statement: `Along a delivery corridor, each zone is either calm (\`0\`) or surging (\`1\`). A rider is happy to cross **at most \`k\` surging zones** in one go.

Given \`readings\` for the zones in corridor order and \`k\`, return the length of the longest stretch of consecutive zones that contains at most \`k\` surging zones.`,
  params: ["readings", "k"],
  examples: [
    { args: [[0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0], 1], output: 5, note: "The last five zones contain one surge." },
    { args: [[1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 0], 2], output: 5 },
    { args: [[1, 1, 1], 0], output: 0 },
  ],
  constraints: ["1 ≤ readings.length ≤ 10⁶", "readings[i] is 0 or 1", "0 ≤ k ≤ readings.length"],
  fn: { js: "longestStretch", py: "longest_stretch" },
  starter: {
    js: `function longestStretch(readings, k) {\n  // your code\n}\n`,
    py: `def longest_stretch(readings, k):\n    # your code\n    pass\n`,
  },
  solution: {
    js: `function longestStretch(readings, k) {
  let left = 0;
  let surging = 0;
  let best = 0;
  for (let right = 0; right < readings.length; right++) {
    if (readings[right] === 1) surging++;
    while (surging > k) {
      if (readings[left] === 1) surging--;
      left++;
    }
    best = Math.max(best, right - left + 1);
  }
  return best;
}`,
    py: `def longest_stretch(readings, k):
    left = 0
    surging = 0
    best = 0
    for right, zone in enumerate(readings):
        if zone == 1:
            surging += 1
        while surging > k:
            if readings[left] == 1:
                surging -= 1
            left += 1
        best = max(best, right - left + 1)
    return best`,
  },
  brute: `function longestStretch(readings, k) {
  let best = 0;
  for (let start = 0; start < readings.length; start++) {
    let surging = 0;
    for (let end = start; end < readings.length; end++) {
      surging += readings[end];
      if (surging > k) break;
      best = Math.max(best, end - start + 1);
    }
  }
  return best;
}`,
  edgeCases: [
    [[0], 0],
    [[1], 0],
    [[1], 1],
    [[0, 0, 0, 0], 0],
    [[1, 0, 1, 0, 1], 5],
  ],
  random: {
    count: 25,
    gen: (r) => {
      const n = randInt(r, 1, 40);
      return [randArray(r, n, 0, 1), randInt(r, 0, Math.min(n, 6))];
    },
  },
  scale: {
    target: "O(n)",
    js: { n: "10⁶ zones, k = 25,000", limitMs: 1500, gen: (r) => [Array.from({ length: 1_000_000 }, () => (r() < 0.02 ? 1 : 0)), 25_000] },
    py: { n: "2 × 10⁵ zones, k = 5,000", limitMs: 6000, gen: (r) => [Array.from({ length: 200_000 }, () => (r() < 0.02 ? 1 : 0)), 5_000] },
  },
  hints: [
    "You don't care where the surges are inside the stretch, only how many there are.",
    "Grow the window to the right and count surges. While the count is over k, shrink from the left.",
    "for right: count += a[right]. while count > k: count −= a[left]; left++. best = max(best, right − left + 1).",
  ],
  walkthrough: {
    idea: "Checking every start and end is O(n²). A valid stretch stays valid if you drop zones from its left end, so you can grow on the right and shrink on the left. Each zone enters once and leaves at most once.",
    complexity: "O(n) time, O(1) extra space.",
    pitfalls: ["Window length is right − left + 1, not right − left.", "Shrink while count > k, not ≥ k, or you throw away valid stretches (and loop forever when k = 0)."],
    followUps: ["Flip at most k zeros to ones and count the run (the classic phrasing).", "Return where the stretch starts.", "Readings arrive as a stream: same algorithm, keep only the window."],
  },
};
