import { randInt, type CodeProblem, type Rand } from "@/content/problem-types";

const word = (r: Rand, len: number, letters: string) => Array.from({ length: len }, () => letters[randInt(r, 0, letters.length - 1)]).join("");

export const sameIngredients: CodeProblem = {
  kind: "code",
  id: "same-ingredients",
  chapter: "hashing",
  n: 3,
  title: "Same ingredients, different codes",
  level: "Medium",
  shape: "Group by a canonical key",
  reference: { label: "LeetCode 49", url: "https://leetcode.com/problems/group-anagrams/" },
  rounds: ["Phone screen", "Coding round"],
  statement: `Each recipe has a short code made from the first letters of its ingredients, in whatever order the chef typed them. Two codes describe the same ingredients when they use exactly the same letters, the same number of times.

Given \`codes\`, group the codes that share ingredients. Return the groups with each group's codes **sorted alphabetically**, and the groups sorted by their first code. Keep repeated codes.`,
  params: ["codes"],
  examples: [
    { args: [["tea", "eat", "ate", "dal", "lad", "rice"]], output: [["ate", "eat", "tea"], ["dal", "lad"], ["rice"]] },
    { args: [["a"]], output: [["a"]] },
    { args: [["ab", "ba", "ab"]], output: [["ab", "ab", "ba"]] },
  ],
  constraints: ["1 ≤ codes.length ≤ 10⁵", "1 ≤ codes[i].length ≤ 10", "Lowercase letters only"],
  fn: { js: "groupByIngredients", py: "group_by_ingredients" },
  starter: {
    js: `function groupByIngredients(codes) {\n  // your code\n}\n`,
    py: `def group_by_ingredients(codes):\n    # your code\n    pass\n`,
  },
  solution: {
    js: `function groupByIngredients(codes) {
  const groups = new Map(); // sorted letters → codes
  for (const code of codes) {
    const key = [...code].sort().join("");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(code);
  }
  return [...groups.values()]
    .map((g) => g.sort())
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}`,
    py: `def group_by_ingredients(codes):
    groups = {}  # sorted letters -> codes
    for code in codes:
        key = "".join(sorted(code))
        groups.setdefault(key, []).append(code)
    return sorted((sorted(g) for g in groups.values()), key=lambda g: g[0])`,
  },
  brute: `function groupByIngredients(codes) {
  const same = (a, b) => a.length === b.length && [...a].sort().join("") === [...b].sort().join("");
  const used = new Array(codes.length).fill(false);
  const out = [];
  for (let i = 0; i < codes.length; i++) {
    if (used[i]) continue;
    const g = [codes[i]];
    for (let j = i + 1; j < codes.length; j++) if (!used[j] && same(codes[i], codes[j])) { used[j] = true; g.push(codes[j]); }
    out.push(g.sort());
  }
  return out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}`,
  edgeCases: [[["abc", "def"]], [["aab", "aba", "baa", "abb"]], [["z", "z", "z"]]],
  random: {
    count: 25,
    gen: (r) => [Array.from({ length: randInt(r, 1, 25) }, () => word(r, randInt(r, 1, 4), "abcd"))],
  },
  scale: {
    target: "O(n · k log k)",
    js: { n: "10⁵ codes of up to 8 letters", limitMs: 2000, gen: (r) => [Array.from({ length: 100_000 }, () => word(r, randInt(r, 4, 8), "abcdefghijklmnop"))] },
    py: { n: "3 × 10⁴ codes", limitMs: 8000, gen: (r) => [Array.from({ length: 30_000 }, () => word(r, randInt(r, 4, 8), "abcdefghijklmnop"))] },
  },
  hints: [
    "Two codes belong together exactly when they look the same after some rearrangement. Which rearrangement is the same for both?",
    "Sort each code's letters: that sorted form is a key. Group codes by key in a hash map.",
    "groups = {}. For code: key = sorted(code); groups[key].append(code). Then sort inside groups and sort the groups.",
  ],
  walkthrough: {
    idea: "Comparing every pair is O(n²) comparisons. Instead, map each code to a canonical form that's identical for all its rearrangements, such as its letters sorted, and use it as a hash-map key. Each code is processed once.",
    complexity: "O(n · k log k) for n codes of length up to k, plus sorting the output.",
    pitfalls: ["Using a set of letters drops counts: 'aab' and 'abb' are not the same.", "Forgetting to sort inside groups and the groups themselves (the output order is part of the answer here).", "Mutating the input while sorting."],
    followUps: ["Long codes: use a 26-count tuple as the key for O(n · k).", "Stream of codes: maintain the map incrementally.", "Find codes with no partner at all."],
  },
};
