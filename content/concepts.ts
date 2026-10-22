// Concepts, each with a signature colour and glyph so it's recognisable wherever it appears,
// and a short definition for the X-Ray lookup.

export type Concept = {
  id: string;
  term: string;
  glyph: "Brackets" | "MoveHorizontal" | "Expand" | "ListOrdered" | "Gauge" | "Hash" | "ArrowLeftRight" | "Layers" | "Timer" | "Split" | "Boxes" | "Calculator" | "Database" | "Link2";
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
  "machine-coding": {
    id: "machine-coding",
    term: "Machine coding",
    glyph: "Timer",
    hue: "amber",
    definition: "An interview round where you build a small working system in 60 to 120 minutes: clean classes, a runnable demo, and an extra requirement the interviewer adds partway through.",
    appearsIn: ["LLD 9 · The 90-minute playbook", "LLD 14–29 · Classic builds"],
  },
  "strategy-pattern": {
    id: "strategy-pattern",
    term: "Strategy pattern",
    glyph: "Split",
    hue: "violet",
    definition: "Each variant of a behaviour (equal, exact or percentage split) lives in its own class behind one interface, so adding a variant means adding a class, not editing a growing if/else.",
    appearsIn: ["LLD 7 · Behavioural patterns", "LLD 15 · Splitwise", "LLD 19 · Rate limiter"],
  },
  "service-layer": {
    id: "service-layer",
    term: "Service layer",
    glyph: "Boxes",
    hue: "violet",
    definition: "The class that holds the use cases (add an expense, settle up). It validates input, coordinates the entities and storage, and is the API the interviewer calls.",
    appearsIn: ["LLD 9 · The 90-minute playbook", "LLD 10 · Storage, repositories, services"],
  },
  netting: {
    id: "netting",
    term: "Netting",
    glyph: "ArrowLeftRight",
    hue: "amber",
    definition: "Keeping one signed balance per pair instead of a list of debts: A owes B ₹200 and B owes A ₹50 becomes A owes B ₹150.",
    appearsIn: ["LLD 15 · Splitwise", "HLD 32 · Payments and ledgers"],
  },
  "back-of-envelope": {
    id: "back-of-envelope",
    term: "Back-of-the-envelope estimate",
    glyph: "Calculator",
    hue: "blue",
    definition: "Quick arithmetic with round numbers (a day is about 10⁵ seconds) to size traffic, storage and machines before choosing a design.",
    appearsIn: ["HLD 1 · The interview framework", "HLD 2 · Estimation", "HLD 22 · URL shortener"],
  },
  "peak-factor": {
    id: "peak-factor",
    term: "Peak factor",
    glyph: "Gauge",
    hue: "blue",
    definition: "How much busier the busiest moment is than the average. Systems are sized for the peak: a 10× promo blast, not a quiet Tuesday.",
    appearsIn: ["HLD 1 · The interview framework", "HLD 39 · Flash sale"],
  },
  "cache-aside": {
    id: "cache-aside",
    term: "Cache-aside",
    glyph: "Database",
    hue: "blue",
    definition: "The app checks the cache first. On a miss it reads the database, then stores the result in the cache for next time.",
    appearsIn: ["HLD 6 · Caching", "HLD 22 · URL shortener", "HLD 26 · News feed"],
  },
  base62: {
    id: "base62",
    term: "Base 62",
    glyph: "Link2",
    hue: "rose",
    definition: "Writing a number with 62 symbols: 0–9, a–z and A–Z. Seven characters cover 62⁷, about 3.5 trillion values.",
    appearsIn: ["HLD 22 · URL shortener", "HLD 23 · Pastebin"],
  },
  "message-queue": {
    id: "message-queue",
    term: "Message queue",
    glyph: "Layers",
    hue: "rose",
    definition: "A durable buffer between the code that produces work and the workers that do it, so slow or failing work (like recording a click) doesn't hold up the request.",
    appearsIn: ["HLD 15 · Queues and streams", "HLD 22 · URL shortener", "HLD 25 · Notification system"],
  },
};
