// Concepts, each with a signature colour and glyph so it's recognisable wherever it appears,
// and a short definition for the X-Ray lookup.

export type Concept = {
  id: string;
  term: string;
  glyph: "Brackets" | "MoveHorizontal" | "Expand" | "ListOrdered" | "Gauge" | "Hash" | "ArrowLeftRight" | "Layers";
  hue: "teal" | "violet" | "amber" | "rose" | "blue";
  definition: string;
  appearsIn: string[];
};

export const concepts: Record<string, Concept> = {
  "sliding-window": {
    id: "sliding-window",
    term: "Sliding window",
    glyph: "Brackets",
    hue: "teal",
    definition: "A range over a sequence that moves forward, updated by adding what enters and removing what leaves instead of recomputing from scratch.",
    appearsIn: ["DSA 9 · Sliding window", "DSA 13 · Monotonic deque", "HLD 17 · Distributed rate limiting", "LLD 19 · Rate limiter"],
  },
  "fixed-window": {
    id: "fixed-window",
    term: "Fixed window",
    glyph: "MoveHorizontal",
    hue: "teal",
    definition: "A window whose size never changes. Each step, one item enters on the right and exactly one leaves on the left.",
    appearsIn: ["DSA 9 · Sliding window", "DSA 10 · Prefix sums"],
  },
  "variable-window": {
    id: "variable-window",
    term: "Variable window",
    glyph: "Expand",
    hue: "teal",
    definition: "A window that grows on the right while it stays valid and shrinks on the left when it breaks a rule, such as 'at most k surges'.",
    appearsIn: ["DSA 9 · Sliding window", "DSA 8 · Two pointers"],
  },
  "monotonic-deque": {
    id: "monotonic-deque",
    term: "Monotonic deque",
    glyph: "ListOrdered",
    hue: "violet",
    definition: "A double-ended queue kept in sorted order by popping values that can never win again. It gives the max or min of a sliding window in O(1) per step.",
    appearsIn: ["DSA 9 · Sliding window", "DSA 13 · Queues and deques"],
  },
  amortised: {
    id: "amortised",
    term: "Amortised cost",
    glyph: "Gauge",
    hue: "amber",
    definition: "The average cost per operation over a whole run. An inner loop can be fine if, across the run, each item enters and leaves at most once.",
    appearsIn: ["DSA 1 · Thinking in cost", "DSA 9 · Sliding window", "DSA 12 · Monotonic stack"],
  },
  "two-pointers": {
    id: "two-pointers",
    term: "Two pointers",
    glyph: "ArrowLeftRight",
    hue: "blue",
    definition: "Two indices that move through a sequence by rules, so each position is visited a small number of times. A sliding window is two pointers that bound a range.",
    appearsIn: ["DSA 8 · Two pointers", "DSA 9 · Sliding window", "DSA 14 · Linked lists"],
  },
  "hash-map": {
    id: "hash-map",
    term: "Hash map",
    glyph: "Hash",
    hue: "rose",
    definition: "A key–value table with O(1) average lookup. In window problems it remembers counts or the last position of each item.",
    appearsIn: ["DSA 3 · Hashing", "DSA 9 · Sliding window"],
  },
};
