import { randInt, type CodeProblem, type Rand } from "@/content/problem-types";

const shuffled = (r: Rand, a: number[]) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const orderRun: CodeProblem = {
  kind: "code",
  id: "order-run",
  chapter: "hashing",
  n: 2,
  title: "Longest unbroken run of order numbers",
  level: "Medium",
  shape: "Set lookups from run starts",
  reference: { label: "LeetCode 128", url: "https://leetcode.com/problems/longest-consecutive-sequence/" },
  rounds: ["Coding round"],
  statement: `Order numbers are handed out one after another, but the support team's export lists them in no particular order, sometimes with repeats.

Given \`ids\`, return the length of the longest run of **consecutive** order numbers that all appear in the export.`,
  params: ["ids"],
  examples: [
    { args: [[1042, 1001, 1044, 1000, 1043, 1002, 1041]], output: 4, note: "1041, 1042, 1043, 1044." },
    { args: [[7, 7, 8]], output: 2 },
    { args: [[]], output: 0 },
  ],
  constraints: ["0 ≤ ids.length ≤ 10⁶", "−10⁹ ≤ ids[i] ≤ 10⁹"],
  fn: { js: "longestRun", py: "longest_run" },
  starter: {
    js: `function longestRun(ids) {\n  // your code\n}\n`,
    py: `def longest_run(ids):\n    # your code\n    pass\n`,
  },
  solution: {
    js: `function longestRun(ids) {
  const present = new Set(ids);
  let best = 0;
  for (const x of present) {
    if (present.has(x - 1)) continue; // only count from the start of a run
    let end = x;
    while (present.has(end + 1)) end++;
    best = Math.max(best, end - x + 1);
  }
  return best;
}`,
    py: `def longest_run(ids):
    present = set(ids)
    best = 0
    for x in present:
        if x - 1 in present:
            continue  # only count from the start of a run
        end = x
        while end + 1 in present:
            end += 1
        best = max(best, end - x + 1)
    return best`,
  },
  brute: `function longestRun(ids) {
  let best = 0;
  for (const x of ids) {
    let len = 1;
    while (ids.includes(x + len)) len++;
    best = Math.max(best, len);
  }
  return ids.length ? best : 0;
}`,
  edgeCases: [[[5]], [[-1, 0, 1]], [[10, 30, 20]], [[3, 2, 1, 2, 3, 4]]],
  random: {
    count: 25,
    gen: (r) => [Array.from({ length: randInt(r, 0, 40) }, () => randInt(r, -20, 20))],
  },
  scale: {
    target: "O(n)",
    js: { n: "10⁶ order numbers", limitMs: 2000, gen: (r) => [shuffled(r, Array.from({ length: 1_000_000 }, (_, i) => i * 2 + (i % 1000 === 0 ? 0 : -(i % 2))))] },
    py: { n: "2 × 10⁵ order numbers", limitMs: 8000, gen: (r) => [shuffled(r, Array.from({ length: 200_000 }, (_, i) => i * 2 + (i % 1000 === 0 ? 0 : -(i % 2))))] },
  },
  hints: [
    "A run is easy to measure if you start from its smallest number.",
    "Put every id in a set. A number starts a run only if number − 1 is missing; from there, count upward.",
    "s = set(ids). For x in s: if x − 1 in s: skip. Else extend end while end + 1 in s; best = max(best, end − x + 1).",
  ],
  walkthrough: {
    idea: "Sorting works in O(n log n), and interviewers usually then ask for O(n). With a set, check each number in O(1). Counting upward from every number would repeat work, so only start counting at numbers whose predecessor is missing. Each number is then visited a constant number of times.",
    complexity: "O(n) time, O(n) space. (Sorting first is O(n log n) and also passes here.)",
    pitfalls: ["Counting from every number, not just run starts, is O(n²) on long runs.", "Forgetting duplicates: iterate the set, not the input.", "An empty export should return 0."],
    followUps: ["Return the run itself.", "Numbers arrive one at a time: union-find over neighbours.", "Allow at most one missing number inside a run."],
  },
};
