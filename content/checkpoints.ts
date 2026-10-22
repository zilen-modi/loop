// Retrieval checkpoints. When a question has a computable answer, `compute` produces it and the
// correct option is derived from that, so an answer key can't silently be wrong.
// `npm run check:content` verifies every one.

export type Checkpoint = {
  id: string;
  prompt: string;
  options: string[];
  compute?: () => string;
  answer?: number; // only for questions that can't be computed
  explain: string;
};

function windowLeftAfter(readings: number[], k: number, uptoRight: number) {
  let left = 0;
  let surging = 0;
  for (let right = 0; right <= uptoRight; right++) {
    if (readings[right] === 1) surging++;
    while (surging > k) {
      if (readings[left] === 1) surging--;
      left++;
    }
  }
  return left;
}

export const checkpoints: Record<string, Checkpoint> = {
  "sw-next-sum": {
    id: "sw-next-sum",
    prompt: "The window holds 3, 8 and 6, so its sum is 17. The next minute brings 2, and the 3 slides out. What is the new sum?",
    options: ["19", "14", "16", "22"],
    compute: () => String(17 - 3 + 2),
    explain: "Subtract what leaves and add what enters: 17 − 3 + 2 = 16. That's one subtraction and one addition, however wide the window is.",
  },
  "sw-ops": {
    id: "sw-ops",
    prompt: "A day of data has n = 1,000,000 minutes and the window is k = 1,000 minutes. Roughly how many additions does recounting every window from scratch take?",
    options: ["About 10³", "About 10⁶", "About 10⁹", "About 10¹²"],
    compute: () => {
      const n = 1_000_000;
      const k = 1_000;
      const ops = (n - k + 1) * k;
      const exp = Math.round(Math.log10(ops));
      return `About 10${String(exp).replace(/\d/g, (d) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(d)])}`;
    },
    explain: "About 10⁶ windows times 10³ additions each is about 10⁹, which takes seconds. The sliding window needs about 2 × 10⁶ operations.",
  },
  "sw-shrink": {
    id: "sw-shrink",
    prompt: "Readings are [0, 1, 0, 0, 1, 0] and at most k = 1 surge is allowed. When the right edge reaches index 4 (the second surge), where does the left edge end up?",
    options: ["Index 0", "Index 1", "Index 2", "Index 4"],
    compute: () => `Index ${windowLeftAfter([0, 1, 0, 0, 1, 0], 1, 4)}`,
    explain: "With two surges in the window, the left edge moves forward until one surge leaves. It passes index 0 (calm), then index 1 (the first surge) and stops at index 2.",
  },
  "sw-which": {
    id: "sw-which",
    prompt: "Which of these needs a variable window rather than a fixed one?",
    options: [
      "The highest total over any 7 consecutive days",
      "The longest run of orders with no repeated dish",
      "The average of every 5 consecutive readings",
      "How many 3-minute windows have more than 10 orders",
    ],
    answer: 1,
    explain: "The others name the window size up front. The longest run without a repeat has no fixed size: it grows while it's valid and shrinks when a dish repeats.",
  },
};

export function correctIndex(c: Checkpoint): number {
  if (c.compute) return c.options.indexOf(c.compute());
  return c.answer ?? -1;
}
