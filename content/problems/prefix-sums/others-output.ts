import { randInt, type CodeProblem, type Rand } from "@/content/problem-types";

/** Mostly ±1, a few 2s and the odd 0, so every product stays an exact integer in both JS and Python. */
function factors(r: Rand, n: number): number[] {
  const out: number[] = Array.from({ length: n }, () => (r() < 0.5 ? 1 : -1));
  const twos = randInt(r, 0, Math.min(20, n));
  for (let t = 0; t < twos; t++) out[randInt(r, 0, n - 1)] = r() < 0.5 ? 2 : -2;
  if (r() < 0.3) out[randInt(r, 0, n - 1)] = 0;
  if (r() < 0.1) out[randInt(r, 0, n - 1)] = 0;
  return out;
}

export const othersOutput: CodeProblem = {
  kind: "code",
  id: "others-output",
  chapter: "prefix-sums",
  n: 3,
  title: "Every other kitchen's multiplier",
  level: "Medium",
  shape: "Prefix and suffix products",
  reference: { label: "LeetCode 238", url: "https://leetcode.com/problems/product-of-array-except-self/" },
  rounds: ["Phone screen", "Coding round"],
  statement: `Each kitchen in a chain applies a demand multiplier. For planning, each kitchen wants the **product of every other kitchen's multiplier**, leaving its own out.

Given \`multipliers\`, return an array where position \`i\` is the product of all multipliers except \`multipliers[i]\`. **Don't use division** (multipliers can be 0). All answers fit in a 32-bit integer.`,
  params: ["multipliers"],
  examples: [
    { args: [[1, 2, 3, 4]], output: [24, 12, 8, 6] },
    { args: [[-1, 1, 0, -3, 3]], output: [0, 0, 9, 0, 0] },
    { args: [[2, 0, 0]], output: [0, 0, 0] },
  ],
  constraints: ["2 ≤ multipliers.length ≤ 10⁶", "Every product fits in a 32-bit integer"],
  fn: { js: "othersProduct", py: "others_product" },
  starter: {
    js: `function othersProduct(multipliers) {\n  // your code\n}\n`,
    py: `def others_product(multipliers):\n    # your code\n    pass\n`,
  },
  solution: {
    js: `function othersProduct(multipliers) {
  const n = multipliers.length;
  const out = new Array(n);
  let left = 1; // product of everything before i
  for (let i = 0; i < n; i++) {
    out[i] = left;
    left *= multipliers[i];
  }
  let right = 1; // product of everything after i
  for (let i = n - 1; i >= 0; i--) {
    out[i] *= right;
    right *= multipliers[i];
  }
  return out.map((x) => (x === 0 ? 0 : x)); // no -0
}`,
    py: `def others_product(multipliers):
    n = len(multipliers)
    out = [1] * n
    left = 1  # product of everything before i
    for i in range(n):
        out[i] = left
        left *= multipliers[i]
    right = 1  # product of everything after i
    for i in range(n - 1, -1, -1):
        out[i] *= right
        right *= multipliers[i]
    return out`,
  },
  brute: `function othersProduct(multipliers) {
  return multipliers.map((_, i) => {
    let p = 1;
    for (let j = 0; j < multipliers.length; j++) if (j !== i) p *= multipliers[j];
    return p === 0 ? 0 : p;
  });
}`,
  edgeCases: [[[3, 4]], [[0, 5]], [[-1, -1, -1]], [[1, 0, 1, 0]]],
  random: { count: 25, gen: (r) => [factors(r, randInt(r, 2, 30))] },
  scale: {
    target: "O(n), no division",
    js: { n: "10⁶ kitchens", limitMs: 1500, gen: (r) => [factors(r, 1_000_000)] },
    py: { n: "2 × 10⁵ kitchens", limitMs: 6000, gen: (r) => [factors(r, 200_000)] },
  },
  hints: [
    "Everything except i is everything before i times everything after i.",
    "One pass left to right records the product before each position; one pass right to left multiplies in the product after it.",
    "out[i] = product before i (left pass). Then right = 1; for i from n − 1 down: out[i] *= right; right *= a[i].",
  ],
  walkthrough: {
    idea: "Dividing the total by each value fails on zeros and is usually banned. Multiplying all others for each position is O(n²). Split 'all but i' into a prefix product and a suffix product: one forward pass stores prefixes in the output, one backward pass multiplies in suffixes with a single running variable.",
    complexity: "O(n) time, O(1) extra space beyond the output.",
    pitfalls: ["Using division, which breaks on 0.", "Storing both prefix and suffix arrays when one running value suffices.", "In JavaScript, −0 can appear; normalise it if you compare outputs."],
    followUps: ["Allow division but handle zeros correctly (count them).", "Product of every window of size k.", "Same idea with sums: prefix minus element."],
  },
};
