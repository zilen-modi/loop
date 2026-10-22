import type { BugHuntProblem } from "@/content/problem-types";

export const reviewCalmStretch: BugHuntProblem = {
  kind: "bug-hunt",
  id: "review-calm-stretch",
  chapter: "sliding-window",
  n: 7,
  title: "Code review: the calm stretch",
  level: "Medium",
  shape: "Find and explain the bug",
  rounds: ["Code comprehension", "Coding round"],
  statement: `Priya on the routing team solved **Calmest long stretch** and asked for a review before merging. Her tests pass on the cases she tried, but production numbers look slightly low.

Read her code, click the line with the bug, and choose why it's wrong.`,
  fnName: "longestStretch",
  lines: [
    "function longestStretch(readings, k) {",
    "  let left = 0;",
    "  let surging = 0;",
    "  let best = 0;",
    "  for (let right = 0; right < readings.length; right++) {",
    "    if (readings[right] === 1) surging++;",
    "    while (surging > k) {",
    "      if (readings[left] === 1) surging--;",
    "      left++;",
    "    }",
    "    best = Math.max(best, right - left);",
    "  }",
    "  return best;",
    "}",
  ],
  bugLine: 10,
  reasons: [
    "The window from left to right holds right − left + 1 zones, so every length is one too short.",
    "The while loop should be an if: the window only ever needs to shrink by one zone.",
    "surging must be reset to 0 each time the window shrinks.",
    "The loop should start at right = 1, because the first zone has nothing to compare with.",
  ],
  reasonIndex: 0,
  explanation:
    "Both ends of the window are inclusive, so its size is right − left + 1. With right − left, a stretch of five zones is reported as four, which is why her numbers were slightly low and why tiny tests like [0] with k = 0 return 0 instead of 1. The shrinking loop is fine: it has to be a while, because one arriving surge may need several calm zones dropped before the count is back within k.",
  probeCases: [
    [[0], 0],
    [[0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0], 1],
    [[1, 0, 1, 0, 1], 5],
  ],
  referenceProblemId: "surge-zones",
};
