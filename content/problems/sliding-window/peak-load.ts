import { randArray, randInt, type CodeProblem } from "@/content/problem-types";

export const peakLoad: CodeProblem = {
  kind: "code",
  id: "peak-load",
  chapter: "sliding-window",
  n: 6,
  title: "Peak load in every window",
  level: "Hard",
  shape: "Monotonic deque",
  reference: { label: "LeetCode 239", url: "https://leetcode.com/problems/sliding-window-maximum/" },
  rounds: ["Coding round", "Onsite"],
  statement: `The dispatch dashboard shows the **peak** number of active riders over the last \`k\` readings, updated after every reading.

Given \`loads\`, the active-rider count at each reading, and \`k\`, return an array with the maximum of every window of \`k\` consecutive readings, from left to right.`,
  params: ["loads", "k"],
  examples: [
    { args: [[3, 1, 4, 1, 5, 9, 2, 6], 3], output: [4, 4, 5, 9, 9, 9] },
    { args: [[7], 1], output: [7] },
    { args: [[2, 2, 2, 1], 2], output: [2, 2, 2] },
  ],
  constraints: ["1 ≤ k ≤ loads.length ≤ 10⁶", "0 ≤ loads[i] ≤ 10⁵"],
  fn: { js: "peakLoads", py: "peak_loads" },
  starter: {
    js: `function peakLoads(loads, k) {\n  // your code\n}\n`,
    py: `def peak_loads(loads, k):\n    # your code\n    pass\n`,
  },
  solution: {
    js: `function peakLoads(loads, k) {
  const candidates = []; // indices, their loads decreasing from head to tail
  let head = 0;
  const peaks = [];
  for (let i = 0; i < loads.length; i++) {
    // A smaller or equal load can never be a peak again once loads[i] arrives.
    while (candidates.length > head && loads[candidates[candidates.length - 1]] <= loads[i]) candidates.pop();
    candidates.push(i);
    if (candidates[head] <= i - k) head++; // the old peak slid out of the window
    if (i >= k - 1) peaks.push(loads[candidates[head]]);
  }
  return peaks;
}`,
    py: `from collections import deque

def peak_loads(loads, k):
    candidates = deque()  # indices, their loads decreasing from left to right
    peaks = []
    for i, load in enumerate(loads):
        # A smaller or equal load can never be a peak again once this one arrives.
        while candidates and loads[candidates[-1]] <= load:
            candidates.pop()
        candidates.append(i)
        if candidates[0] <= i - k:  # the old peak slid out of the window
            candidates.popleft()
        if i >= k - 1:
            peaks.append(loads[candidates[0]])
    return peaks`,
  },
  brute: `function peakLoads(loads, k) {
  const peaks = [];
  for (let start = 0; start + k <= loads.length; start++) {
    let best = -Infinity;
    for (let i = start; i < start + k; i++) best = Math.max(best, loads[i]);
    peaks.push(best);
  }
  return peaks;
}`,
  edgeCases: [
    [[5, 4, 3, 2, 1], 2],
    [[1, 2, 3, 4, 5], 2],
    [[1, 3, 1, 3, 1], 5],
    [[4, 4, 4], 1],
  ],
  random: {
    count: 25,
    gen: (r) => {
      const n = randInt(r, 1, 40);
      return [randArray(r, n, 0, 30), randInt(r, 1, n)];
    },
  },
  scale: {
    target: "O(n)",
    js: { n: "10⁶ readings, k = 10,000", limitMs: 2000, gen: (r) => [randArray(r, 1_000_000, 0, 100_000), 10_000] },
    py: { n: "2 × 10⁵ readings, k = 2,000", limitMs: 8000, gen: (r) => [randArray(r, 200_000, 0, 100_000), 2_000] },
  },
  hints: [
    "When a bigger load arrives, every smaller load before it can never be the peak of any later window.",
    "Keep a deque of indices whose loads are decreasing. Pop smaller loads from the back; drop the front when it leaves the window.",
    "for i: while back load ≤ loads[i]: pop back. push i. if front ≤ i − k: pop front. if i ≥ k − 1: output loads[front].",
  ],
  walkthrough: {
    idea: "A plain running total can't answer max, because removing the old maximum tells you nothing about the next one. Keep only the readings that could still become a peak: those with no larger reading after them. They form a decreasing queue; the front is the current peak, and each index is pushed and popped at most once.",
    complexity: "O(n) time amortised, O(k) extra space.",
    pitfalls: ["Store indices, not values, so you can tell when the front has left the window.", "Pop with ≤ (not <) on the back, or equal values pile up; either is correct, ≤ keeps the deque smaller.", "Shifting a JS array from the front is O(n); use a head pointer or a real deque."],
    followUps: ["Window minimum: same idea with an increasing deque.", "Max of every window in a stream with variable k.", "Shortest subarray with sum at least K (LeetCode 862) uses the same monotonic deque."],
  },
};
