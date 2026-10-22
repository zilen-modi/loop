import { randInt, type CodeProblem, type Rand } from "@/content/problem-types";

const ALNUM = "abcdefABCDEF0123456789";
const NOISE = "-_ .:/#";

/** About half of these are palindromes once noise and case are ignored. */
function code(r: Rand, half: number): string {
  const core = Array.from({ length: half }, () => ALNUM[randInt(r, 0, ALNUM.length - 1)]);
  const mirrored = [...core, ...(r() < 0.5 ? [ALNUM[randInt(r, 0, 9)]] : []), ...[...core].reverse()];
  if (r() < 0.5 && mirrored.length > 1) mirrored[randInt(r, 0, mirrored.length - 1)] = ALNUM[randInt(r, 0, ALNUM.length - 1)];
  const flipped = mirrored.map((c) => (r() < 0.5 ? c.toLowerCase() : c.toUpperCase()));
  return flipped.map((c) => (r() < 0.25 ? NOISE[randInt(r, 0, NOISE.length - 1)] + c : c)).join("");
}

export const mirrorCode: CodeProblem = {
  kind: "code",
  id: "mirror-code",
  chapter: "two-pointers",
  n: 1,
  title: "Mirror coupon code",
  level: "Easy",
  shape: "Pointers from both ends",
  reference: { label: "LeetCode 125", url: "https://leetcode.com/problems/valid-palindrome/" },
  rounds: ["Phone screen"],
  statement: `A festival promotion only accepts **mirror** coupon codes: codes that read the same forwards and backwards once you ignore everything except letters and digits, and ignore upper and lower case.

Given \`code\`, return \`true\` if it's a mirror code and \`false\` otherwise. Codes contain only plain ASCII characters.`,
  params: ["code"],
  examples: [
    { args: ["Ab-12-21-bA"], output: true },
    { args: ["Tiffin"], output: false },
    { args: ["--"], output: true, note: "Nothing left to compare reads the same both ways." },
  ],
  constraints: ["1 ≤ code.length ≤ 2 × 10⁶", "ASCII characters only"],
  fn: { js: "isMirrorCode", py: "is_mirror_code" },
  starter: {
    js: `function isMirrorCode(code) {\n  // your code\n}\n`,
    py: `def is_mirror_code(code):\n    # your code\n    pass\n`,
  },
  solution: {
    js: `function isMirrorCode(code) {
  const keep = (c) => /[a-z0-9]/i.test(c);
  let i = 0;
  let j = code.length - 1;
  while (i < j) {
    if (!keep(code[i])) { i++; continue; }
    if (!keep(code[j])) { j--; continue; }
    if (code[i].toLowerCase() !== code[j].toLowerCase()) return false;
    i++;
    j--;
  }
  return true;
}`,
    py: `def is_mirror_code(code):
    i, j = 0, len(code) - 1
    while i < j:
        if not code[i].isalnum():
            i += 1
        elif not code[j].isalnum():
            j -= 1
        elif code[i].lower() != code[j].lower():
            return False
        else:
            i += 1
            j -= 1
    return True`,
  },
  brute: `function isMirrorCode(code) {
  const clean = code.toLowerCase().replace(/[^a-z0-9]/g, "");
  return clean === [...clean].reverse().join("");
}`,
  scaleSeparates: false,
  edgeCases: [["a"], ["ab"], ["0P"], ["A man, a plan"], [".,"]],
  random: { count: 25, gen: (r) => [code(r, randInt(r, 0, 8))] },
  scale: {
    target: "O(n) time, O(1) space",
    js: { n: "a 2 × 10⁶-character code", limitMs: 1500, gen: (r) => [code(r, 700_000)] },
    py: { n: "a 4 × 10⁵-character code", limitMs: 6000, gen: (r) => [code(r, 140_000)] },
  },
  hints: [
    "Compare the outside characters first, then work inwards.",
    "Use one pointer at each end. Skip anything that isn't a letter or digit; compare the rest case-insensitively.",
    "i = 0, j = n − 1. While i < j: skip non-alphanumerics on either side; if lower(c[i]) ≠ lower(c[j]): return false; i++, j−−.",
  ],
  walkthrough: {
    idea: "Cleaning the string and comparing it with its reverse works, but builds two extra copies. Two pointers moving inwards compare the same characters in place: skip what doesn't count, compare what does, and stop at the first mismatch.",
    complexity: "O(n) time, O(1) extra space.",
    pitfalls: ["Comparing before skipping noise on both sides.", "Forgetting digits count.", "Case: 'A' and 'a' match, '0' and 'O' don't."],
    followUps: ["Allow deleting at most one character (LeetCode 680).", "Longest mirror stretch inside the code (LeetCode 5).", "Unicode letters: what counts as a letter?"],
  },
};
