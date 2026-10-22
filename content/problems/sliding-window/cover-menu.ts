import { randInt, type CodeProblem, type Rand } from "@/content/problem-types";

const items = ["tea", "samosa", "dal", "rice", "roti", "lassi", "paneer", "kheer"];

function rareRequired(r: Rand, n: number, common: number, rare: number) {
  // Mostly common items, with rare required items sprinkled in, so covering windows are long.
  const menu = Array.from({ length: n }, () => `item${randInt(r, 0, common - 1)}`);
  for (let i = 0; i < n; i++) if (r() < 0.002) menu[i] = `rare${randInt(r, 0, rare - 1)}`;
  const required = Array.from({ length: rare }, (_, i) => `rare${i}`);
  return [menu, required];
}

export const coverMenu: CodeProblem = {
  kind: "code",
  id: "cover-menu",
  chapter: "sliding-window",
  n: 5,
  title: "Shortest stretch covering the order",
  level: "Hard",
  shape: "Shrinking window and counts",
  reference: { label: "LeetCode 76", url: "https://leetcode.com/problems/minimum-window-substring/" },
  rounds: ["Coding round", "Onsite"],
  statement: `A kitchen's conveyor belt carries prepared items in a line. A group order needs every item in \`required\` (an item listed twice is needed twice).

Return \`[start, end]\`, the indices of the **shortest** contiguous stretch of \`belt\` that contains all of \`required\`. If several stretches are equally short, return the leftmost. If no stretch works, return \`[]\`.`,
  params: ["belt", "required"],
  examples: [
    { args: [["tea", "samosa", "dal", "rice", "tea", "roti", "samosa", "dal"], ["dal", "tea", "roti"]], output: [2, 5], note: "dal, rice, tea, roti." },
    { args: [["roti", "roti", "dal"], ["roti", "roti"]], output: [0, 1] },
    { args: [["dal"], ["paneer"]], output: [] },
  ],
  constraints: ["1 ≤ belt.length ≤ 10⁶", "1 ≤ required.length ≤ 10⁵", "Item names are short strings"],
  fn: { js: "shortestCover", py: "shortest_cover" },
  starter: {
    js: `function shortestCover(belt, required) {\n  // your code\n}\n`,
    py: `def shortest_cover(belt, required):\n    # your code\n    pass\n`,
  },
  solution: {
    js: `function shortestCover(belt, required) {
  const need = new Map();
  for (const item of required) need.set(item, (need.get(item) || 0) + 1);
  const have = new Map();
  let missing = required.length;
  let left = 0;
  let bestStart = -1;
  let bestLength = Infinity;
  for (let right = 0; right < belt.length; right++) {
    const item = belt[right];
    if (need.has(item)) {
      const count = (have.get(item) || 0) + 1;
      have.set(item, count);
      if (count <= need.get(item)) missing--;
    }
    while (missing === 0) {
      if (right - left + 1 < bestLength) {
        bestLength = right - left + 1;
        bestStart = left;
      }
      const out = belt[left];
      if (need.has(out)) {
        const count = have.get(out) - 1;
        have.set(out, count);
        if (count < need.get(out)) missing++;
      }
      left++;
    }
  }
  return bestStart === -1 ? [] : [bestStart, bestStart + bestLength - 1];
}`,
    py: `def shortest_cover(belt, required):
    need = {}
    for item in required:
        need[item] = need.get(item, 0) + 1
    have = {}
    missing = len(required)
    left = 0
    best_start, best_length = -1, float("inf")
    for right, item in enumerate(belt):
        if item in need:
            have[item] = have.get(item, 0) + 1
            if have[item] <= need[item]:
                missing -= 1
        while missing == 0:
            if right - left + 1 < best_length:
                best_start, best_length = left, right - left + 1
            out = belt[left]
            if out in need:
                have[out] -= 1
                if have[out] < need[out]:
                    missing += 1
            left += 1
    return [] if best_start == -1 else [best_start, best_start + best_length - 1]`,
  },
  brute: `function shortestCover(belt, required) {
  let best = [];
  for (let start = 0; start < belt.length; start++) {
    const need = new Map();
    for (const item of required) need.set(item, (need.get(item) || 0) + 1);
    let missing = required.length;
    for (let end = start; end < belt.length; end++) {
      const c = need.get(belt[end]);
      if (c !== undefined) { if (c > 0) missing--; need.set(belt[end], c - 1); }
      if (missing === 0) {
        if (best.length === 0 || end - start < best[1] - best[0]) best = [start, end];
        break;
      }
    }
  }
  return best;
}`,
  edgeCases: [
    [["tea"], ["tea"]],
    [["tea", "dal"], ["dal", "tea"]],
    [["dal", "dal"], ["dal", "dal", "dal"]],
    [["a", "b", "a", "b", "c", "a"], ["a", "b", "c"]],
  ],
  random: {
    count: 25,
    gen: (r) => {
      const variety = randInt(r, 2, items.length);
      const belt = Array.from({ length: randInt(r, 1, 40) }, () => items[randInt(r, 0, variety - 1)]);
      const required = Array.from({ length: randInt(r, 1, 4) }, () => items[randInt(r, 0, variety - 1)]);
      return [belt, required];
    },
  },
  scale: {
    target: "O(n + m)",
    js: { n: "10⁶ items, 40 rare required", limitMs: 2000, gen: (r) => rareRequired(r, 1_000_000, 200, 40) },
    py: { n: "2 × 10⁵ items, 20 rare required", limitMs: 8000, gen: (r) => rareRequired(r, 200_000, 200, 20) },
  },
  hints: [
    "First find any stretch that covers the order, then see how much you can trim from its left.",
    "Count what you still need. Expand right until nothing is missing, then shrink left while it stays covered, recording the shortest.",
    "missing = len(required). Expand: if belt[r] is still needed, missing−−. While missing == 0: record, then remove belt[l] (if that makes an item short, missing++), l++.",
  ],
  walkthrough: {
    idea: "A covering stretch stays covering if you add items, and you can only trim from the left until something required drops out. So expand to the right until covered, then shrink from the left while still covered, and record the shortest window you pass through. One `missing` counter avoids comparing whole maps.",
    complexity: "O(n + m) time for belt length n and m required items; O(m) space.",
    pitfalls: ["Duplicates in `required`: count them, don't use a set.", "Only decrement `missing` while an item is still needed (count ≤ need); extra copies don't help.", "Update the best window only on strict improvement to keep the leftmost."],
    followUps: ["Items must appear in order (a different problem: subsequence windows).", "Return the length only.", "Huge alphabet: map items to ids first."],
  },
};
