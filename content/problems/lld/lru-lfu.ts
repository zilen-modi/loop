import { randInt, type BuildProblem, type Rand, type Step } from "@/content/problem-types";

/** A big cache filled to capacity, then hammered with lookups and updates. */
function hotMenus(r: Rand, capacity: number, ops: number, lfu: boolean): Step[] {
  const steps: Step[] = [];
  if (lfu) steps.push({ call: "setPolicy", args: ["lfu"] });
  steps.push({ call: "setCapacity", args: [capacity] });
  for (let k = 0; k < capacity; k++) steps.push({ call: "put", args: [k, `menu-${k}`] });
  const space = Math.round(capacity * 1.4);
  for (let i = 0; i < ops; i++) {
    // Popular menus are asked for far more often: skew the keys towards the low numbers.
    const key = Math.floor(space * Math.pow(r(), 2.2));
    const roll = r();
    if (roll < 0.62) steps.push({ call: "get", args: [key] });
    else if (roll < 0.999) steps.push({ call: "put", args: [key, `menu-${key}-v${i}`] });
    else steps.push({ call: "size", args: [] });
  }
  return steps;
}

/** A small cache with every kind of call, including shrinking and the occasional bad input. */
function smallBusy(r: Rand, ops: number, lfu: boolean): Step[] {
  const steps: Step[] = [{ call: "setCapacity", args: [12] }];
  if (lfu) steps.unshift({ call: "setPolicy", args: ["lfu"] });
  for (let i = 0; i < ops; i++) {
    const key = `m${randInt(r, 0, 30)}`;
    const roll = r();
    if (roll < 0.45) steps.push({ call: "get", args: [key] });
    else if (roll < 0.85) steps.push({ call: "put", args: [key, randInt(r, 0, 99)] });
    else if (roll < 0.9) steps.push({ call: "keys", args: [] });
    else if (roll < 0.93) steps.push({ call: "setCapacity", args: [randInt(r, 4, 16)] });
    else if (roll < 0.96 && lfu) steps.push({ call: "frequency", args: [key] });
    else if (roll < 0.98) steps.push({ call: "setCapacity", args: [0] }); // must be refused
    else steps.push({ call: "size", args: [] });
  }
  return steps;
}

const cap = (n: number): Step => ({ call: "setCapacity", args: [n], expect: [] });

export const lruLfu: BuildProblem = {
  kind: "build",
  id: "lru-lfu-cache",
  chapter: "lru-lfu-cache",
  n: 1,
  title: "A menu cache: LRU, then LFU",
  level: "Medium",
  shape: "Machine coding · O(1) data structures",
  rounds: ["Machine coding", "Coding round"],
  minutes: 60,
  statement: `Restaurant pages at Tiffin load their menus from a slow service. Build \`MenuCache\`, an in-memory cache that keeps the most useful menus and drops the rest when it's full.

Every operation must take **constant time** on average, whatever the size. One hidden scenario fills a 50,000-item cache and then runs 100,000 more operations against a time limit; a cache that scans a list on each call won't finish in time.

After the core passes, the interviewer changes which item gets dropped, just as in a real round.`,
  requirements: {
    core: [
      "Set a capacity, and change it later (shrinking drops items).",
      "Get a value by key; a get counts as a use.",
      "Put a value; when full, drop the least recently used item first.",
      "Report the size, and the keys from most to least recently used.",
      "Reject invalid input with an error and change nothing.",
    ],
    extension: ["A second eviction policy, LFU: drop the item used the fewest times, breaking ties by least recent use.", "Report how many times a key has been used."],
  },
  api: [
    { js: "setCapacity(n)", py: "set_capacity(n)", does: "n is a whole number ≥ 1. Returns the keys it had to drop, in the order dropped ([] if none).", stage: "core" },
    { js: "get(key)", py: "get(key)", does: "The value, or null (None) if absent. A hit is a use.", stage: "core" },
    { js: "put(key, value)", py: "put(key, value)", does: "Adds or updates. Returns the key it dropped to make room, or null. Updating counts as a use and never drops anything.", stage: "core" },
    { js: "size()", py: "size()", does: "How many items are cached.", stage: "core" },
    { js: "keys()", py: "keys()", does: "Keys from most to least recently used (whatever the policy).", stage: "core" },
    { js: "setPolicy(policy)", py: "set_policy(policy)", does: "\"lru\" or \"lfu\". Only while the cache is empty.", stage: "extension" },
    { js: "frequency(key)", py: "frequency(key)", does: "How many uses the key has had since it was added (0 if absent).", stage: "extension" },
  ],
  rules: [
    "Keys and values are strings, numbers or booleans. A stored 0, \"\" or false is a real value, not a miss.",
    "A use is a get that hits, or a put. A new key starts with 1 use; every later get or put on it adds 1.",
    "LRU (the default): when full, put drops the least recently used key, then adds the new one.",
    "Shrinking with setCapacity drops keys by the current policy until the size fits.",
    "Errors (JavaScript: throw an Error; Python: raise ValueError), changing nothing: get or put before any setCapacity; a capacity that isn't a whole number ≥ 1.",
    "LFU (extension): drop the key with the fewest uses; among those, the least recently used one.",
    "setPolicy (extension) works only on an empty cache, and only with \"lru\" or \"lfu\"; anything else is an error.",
    "Speed: every call except keys() takes O(1) time on average.",
  ],
  className: "MenuCache",
  starter: {
    js: `class MenuCache {
  constructor() {
    // your state here
  }

  setCapacity(n) {
    return [];
  }

  get(key) {
    return null;
  }

  put(key, value) {
    return null;
  }

  size() {
    return 0;
  }

  keys() {
    return [];
  }

  // The interviewer adds more once the core works
}
`,
    py: `class MenuCache:
    def __init__(self):
        pass  # your state here

    def set_capacity(self, n):
        return []

    def get(self, key):
        return None

    def put(self, key, value):
        return None

    def size(self):
        return 0

    def keys(self):
        return []

    # The interviewer adds more once the core works
`,
  },
  solution: {
    js: `// Recency is a Map: a JavaScript Map keeps insertion order, so delete + set moves a key to the
// end (most recent) in O(1). For LFU, keys also sit in a bucket per use count; each bucket is a
// Map too, so its first key is its least recently used.
class MenuCache {
  constructor() {
    this.capacity = 0;
    this.policy = "lru";
    this.values = new Map(); // key → value, least to most recently used
    this.uses = new Map(); // key → number of uses
    this.buckets = new Map(); // uses → Map of keys, least to most recently used
    this.minUses = 0; // the smallest use count present (kept up to date for LFU)
  }

  setCapacity(n) {
    if (!Number.isInteger(n) || n < 1) throw new Error("Capacity must be a whole number, at least 1");
    this.capacity = n;
    const dropped = [];
    while (this.values.size > n) dropped.push(this.evict());
    return dropped;
  }

  setPolicy(policy) {
    if (policy !== "lru" && policy !== "lfu") throw new Error("Policy must be lru or lfu");
    if (this.values.size) throw new Error("Change the policy only while the cache is empty");
    this.policy = policy;
  }

  get(key) {
    this.ready();
    if (!this.values.has(key)) return null;
    const value = this.values.get(key);
    this.use(key, value);
    return value;
  }

  put(key, value) {
    this.ready();
    if (this.values.has(key)) {
      this.use(key, value);
      return null;
    }
    const dropped = this.values.size >= this.capacity ? this.evict() : null;
    this.values.set(key, value);
    this.uses.set(key, 1);
    this.bucket(1).set(key, true);
    this.minUses = 1;
    return dropped;
  }

  size() {
    return this.values.size;
  }

  keys() {
    return [...this.values.keys()].reverse();
  }

  frequency(key) {
    return this.uses.get(key) ?? 0;
  }

  ready() {
    if (!this.capacity) throw new Error("Set a capacity first");
  }

  bucket(n) {
    if (!this.buckets.has(n)) this.buckets.set(n, new Map());
    return this.buckets.get(n);
  }

  // One more use: most recent now, and up one bucket.
  use(key, value) {
    this.values.delete(key);
    this.values.set(key, value);
    const n = this.uses.get(key);
    this.leave(key, n);
    if (this.minUses === n && !this.buckets.has(n)) this.minUses = n + 1;
    this.uses.set(key, n + 1);
    this.bucket(n + 1).set(key, true);
  }

  leave(key, n) {
    const b = this.buckets.get(n);
    b.delete(key);
    if (!b.size) this.buckets.delete(n);
  }

  evict() {
    const key = this.policy === "lfu" ? this.buckets.get(this.minUses).keys().next().value : this.values.keys().next().value;
    this.leave(key, this.uses.get(key));
    this.values.delete(key);
    this.uses.delete(key);
    // Only shrinking can empty the smallest bucket without a put right after; rare, so a scan is fine.
    if (this.values.size && !this.buckets.has(this.minUses)) this.minUses = Math.min(...this.buckets.keys());
    return key;
  }
}
`,
    py: `# Recency is an OrderedDict: move_to_end makes a key the most recent in O(1). For LFU, keys also
# sit in a bucket per use count; each bucket is an OrderedDict, so its first key is its least recent.
from collections import OrderedDict


def whole(n):
    return isinstance(n, int) and not isinstance(n, bool)


class MenuCache:
    def __init__(self):
        self.capacity = 0
        self.policy = "lru"
        self.values = OrderedDict()  # least to most recently used
        self.uses = {}
        self.buckets = {}  # uses -> OrderedDict of keys, least to most recently used
        self.min_uses = 0

    def set_capacity(self, n):
        if not whole(n) or n < 1:
            raise ValueError("Capacity must be a whole number, at least 1")
        self.capacity = n
        dropped = []
        while len(self.values) > n:
            dropped.append(self._evict())
        return dropped

    def set_policy(self, policy):
        if policy not in ("lru", "lfu"):
            raise ValueError("Policy must be lru or lfu")
        if self.values:
            raise ValueError("Change the policy only while the cache is empty")
        self.policy = policy

    def get(self, key):
        self._ready()
        if key not in self.values:
            return None
        value = self.values[key]
        self._use(key, value)
        return value

    def put(self, key, value):
        self._ready()
        if key in self.values:
            self._use(key, value)
            return None
        dropped = self._evict() if len(self.values) >= self.capacity else None
        self.values[key] = value
        self.uses[key] = 1
        self.buckets.setdefault(1, OrderedDict())[key] = True
        self.min_uses = 1
        return dropped

    def size(self):
        return len(self.values)

    def keys(self):
        return list(reversed(self.values))

    def frequency(self, key):
        return self.uses.get(key, 0)

    def _ready(self):
        if not self.capacity:
            raise ValueError("Set a capacity first")

    def _use(self, key, value):
        self.values[key] = value
        self.values.move_to_end(key)
        n = self.uses[key]
        self._leave(key, n)
        if self.min_uses == n and n not in self.buckets:
            self.min_uses = n + 1
        self.uses[key] = n + 1
        self.buckets.setdefault(n + 1, OrderedDict())[key] = True

    def _leave(self, key, n):
        b = self.buckets[n]
        del b[key]
        if not b:
            del self.buckets[n]

    def _evict(self):
        if self.policy == "lfu":
            key = next(iter(self.buckets[self.min_uses]))
        else:
            key = next(iter(self.values))
        self._leave(key, self.uses[key])
        del self.values[key]
        del self.uses[key]
        if self.values and self.min_uses not in self.buckets:
            self.min_uses = min(self.buckets)
        return key
`,
  },
  scenarios: [
    {
      name: "Least recently used goes first",
      stage: "core",
      visible: true,
      steps: [
        cap(2),
        { call: "put", args: ["a", 1], expect: null },
        { call: "put", args: ["b", 2], expect: null },
        { call: "get", args: ["a"], expect: 1 },
        { call: "put", args: ["c", 3], expect: "b", note: "a was used more recently than b" },
        { call: "get", args: ["b"], expect: null },
        { call: "keys", args: [], expect: ["c", "a"] },
        { call: "size", args: [], expect: 2 },
      ],
    },
    {
      name: "Updating a key is a use",
      stage: "core",
      visible: true,
      steps: [
        cap(2),
        { call: "put", args: ["a", 1] },
        { call: "put", args: ["b", 2] },
        { call: "put", args: ["a", 10], expect: null, note: "an update never drops anything" },
        { call: "put", args: ["c", 3], expect: "b" },
        { call: "get", args: ["a"], expect: 10 },
      ],
    },
    {
      name: "A miss changes nothing",
      stage: "core",
      visible: true,
      steps: [
        cap(2),
        { call: "put", args: ["a", 1] },
        { call: "put", args: ["b", 2] },
        { call: "get", args: ["zzz"], expect: null },
        { call: "put", args: ["c", 3], expect: "a" },
        { call: "keys", args: [], expect: ["c", "b"] },
      ],
    },
    {
      name: "Shrinking drops the least recently used",
      stage: "core",
      steps: [
        cap(3),
        { call: "put", args: ["a", 1] },
        { call: "put", args: ["b", 2] },
        { call: "put", args: ["c", 3] },
        { call: "get", args: ["a"] },
        { call: "setCapacity", args: [1], expect: ["b", "c"] },
        { call: "keys", args: [], expect: ["a"] },
        { call: "setCapacity", args: [3], expect: [] },
        { call: "put", args: ["d", 4], expect: null },
        { call: "keys", args: [], expect: ["d", "a"] },
      ],
    },
    {
      name: "A cache of one",
      stage: "core",
      steps: [
        cap(1),
        { call: "put", args: ["a", 1], expect: null },
        { call: "put", args: ["b", 2], expect: "a" },
        { call: "get", args: ["a"], expect: null },
        { call: "get", args: ["b"], expect: 2 },
        { call: "put", args: ["b", 3], expect: null },
        { call: "size", args: [], expect: 1 },
      ],
    },
    {
      name: "Falsy values are real values",
      stage: "core",
      steps: [
        cap(3),
        { call: "put", args: ["zero", 0] },
        { call: "put", args: ["empty", ""] },
        { call: "put", args: ["no", false] },
        { call: "get", args: ["zero"], expect: 0 },
        { call: "get", args: ["empty"], expect: "" },
        { call: "get", args: ["no"], expect: false },
        { call: "keys", args: [], expect: ["no", "empty", "zero"] },
      ],
    },
    {
      name: "Bad input is rejected and changes nothing",
      stage: "core",
      steps: [
        { call: "get", args: ["a"], throws: true },
        { call: "put", args: ["a", 1], throws: true },
        { call: "setCapacity", args: [0], throws: true },
        { call: "setCapacity", args: [2.5], throws: true },
        { call: "setCapacity", args: ["2"], throws: true },
        cap(2),
        { call: "put", args: ["a", 1] },
        { call: "setCapacity", args: [-1], throws: true },
        { call: "size", args: [], expect: 1 },
        { call: "put", args: ["b", 2], expect: null, note: "still capacity 2" },
        { call: "put", args: ["c", 3], expect: "a" },
      ],
    },
    {
      name: "Numbers and strings are different keys",
      stage: "core",
      steps: [
        cap(3),
        { call: "put", args: [1, "number"] },
        { call: "put", args: ["1", "string"] },
        { call: "get", args: [1], expect: "number" },
        { call: "get", args: ["1"], expect: "string" },
        { call: "size", args: [], expect: 2 },
      ],
    },
    {
      name: "LFU drops the least used",
      stage: "extension",
      visible: true,
      steps: [
        { call: "setPolicy", args: ["lfu"] },
        cap(2),
        { call: "put", args: ["a", 1] },
        { call: "put", args: ["b", 2] },
        { call: "get", args: ["a"], expect: 1 },
        { call: "put", args: ["c", 3], expect: "b", note: "a has 2 uses, b has 1" },
        { call: "get", args: ["c"], expect: 3 },
        { call: "get", args: ["c"], expect: 3 },
        { call: "put", args: ["d", 4], expect: "a", note: "a has 2 uses, c has 3" },
        { call: "frequency", args: ["c"], expect: 3 },
        { call: "frequency", args: ["d"], expect: 1 },
        { call: "frequency", args: ["a"], expect: 0 },
      ],
    },
    {
      name: "LFU ties go to the least recently used",
      stage: "extension",
      visible: true,
      steps: [
        { call: "setPolicy", args: ["lfu"] },
        cap(3),
        { call: "put", args: ["a", 1] },
        { call: "put", args: ["b", 2] },
        { call: "put", args: ["c", 3] },
        { call: "get", args: ["a"] },
        { call: "get", args: ["b"] },
        { call: "put", args: ["d", 4], expect: "c" },
        { call: "get", args: ["d"] },
        { call: "get", args: ["d"] },
        { call: "put", args: ["e", 5], expect: "a", note: "a and b both have 2 uses; a's last use was earlier" },
      ],
    },
    {
      name: "Policies change only on an empty cache",
      stage: "extension",
      steps: [
        cap(2),
        { call: "setPolicy", args: ["fifo"], throws: true },
        { call: "put", args: ["a", 1] },
        { call: "setPolicy", args: ["lfu"], throws: true },
        { call: "put", args: ["b", 2] },
        { call: "get", args: ["a"] },
        { call: "get", args: ["b"] },
        { call: "put", args: ["c", 3], expect: "a", note: "still LRU" },
        { call: "setCapacity", args: [1], expect: ["b"] },
        { call: "setCapacity", args: [2], expect: [] },
      ],
    },
    {
      name: "Shrinking under LFU, and updates count as uses",
      stage: "extension",
      steps: [
        { call: "setPolicy", args: ["lfu"] },
        cap(4),
        { call: "put", args: ["a", 1] },
        { call: "put", args: ["b", 2] },
        { call: "put", args: ["c", 3] },
        { call: "put", args: ["d", 4] },
        { call: "put", args: ["b", 20] },
        { call: "put", args: ["b", 21] },
        { call: "get", args: ["c"] },
        { call: "frequency", args: ["b"], expect: 3 },
        { call: "setCapacity", args: [2], expect: ["a", "d"], note: "a and d have 1 use each; a is older" },
        { call: "setCapacity", args: [1], expect: ["c"], note: "c has 2 uses, b has 3" },
        { call: "keys", args: [], expect: ["b"] },
        { call: "get", args: ["b"], expect: 21 },
      ],
    },
  ],
  generated: [
    { name: "A 50,000-menu cache, then 100,000 lookups and updates", stage: "core", limitMs: 1200, gen: (r) => hotMenus(r, 50_000, 100_000, false) },
    { name: "A small cache, every kind of call, 4,000 times", stage: "core", limitMs: 2000, gen: (r) => smallBusy(r, 4000, false) },
    { name: "LFU: a 30,000-menu cache, then 60,000 operations", stage: "extension", limitMs: 1200, gen: (r) => hotMenus(r, 30_000, 60_000, true) },
    { name: "LFU: a small cache, every kind of call, 4,000 times", stage: "extension", limitMs: 2000, gen: (r) => smallBusy(r, 4000, true) },
  ],
  mutants: [
    { name: "A get doesn't count as a use", from: "    const value = this.values.get(key);\n    this.use(key, value);\n", to: "    const value = this.values.get(key);\n" },
    { name: "Drops the most recently used", from: ": this.values.keys().next().value;", to: ": [...this.values.keys()].pop();" },
    { name: "Treats a stored 0 as a miss", from: "if (!this.values.has(key)) return null;", to: "if (!this.values.get(key)) return null;" },
    { name: "LFU ties drop the newest", from: "this.buckets.get(this.minUses).keys().next().value", to: "[...this.buckets.get(this.minUses).keys()].pop()" },
    { name: "An update drops something when full", from: "    if (this.values.has(key)) {\n      this.use(key, value);\n      return null;\n    }\n    const dropped", to: "    const dropped" },
  ],
  slowVariant: {
    name: "Recency kept in an array (indexOf + splice on every call)",
    js: `class MenuCache {
  constructor() { this.capacity = 0; this.order = []; this.values = new Map(); }
  setCapacity(n) {
    if (!Number.isInteger(n) || n < 1) throw new Error("bad");
    this.capacity = n;
    const dropped = [];
    while (this.order.length > n) { const k = this.order.shift(); this.values.delete(k); dropped.push(k); }
    return dropped;
  }
  touch(key) { this.order.splice(this.order.indexOf(key), 1); this.order.push(key); }
  get(key) { if (!this.capacity) throw new Error("bad"); if (!this.values.has(key)) return null; this.touch(key); return this.values.get(key); }
  put(key, value) {
    if (!this.capacity) throw new Error("bad");
    if (this.values.has(key)) { this.values.set(key, value); this.touch(key); return null; }
    let dropped = null;
    if (this.order.length >= this.capacity) { dropped = this.order.shift(); this.values.delete(dropped); }
    this.order.push(key); this.values.set(key, value);
    return dropped;
  }
  size() { return this.values.size; }
  keys() { return [...this.order].reverse(); }
}
`,
  },
  hints: [
    "What does every call need to find instantly? The value for a key, and the least recently used key. One structure can't do both in O(1); two can, if they stay in step.",
    "A hash map gives values in O(1). For recency you need a list you can remove from the middle in O(1): a doubly linked list with a map to its nodes, or a language map that keeps insertion order (JavaScript's Map, Python's OrderedDict).",
    "LRU: on every use, move the key to the most-recent end; evict from the other end. LFU: also keep one recency-ordered group of keys per use count and the smallest count present; a use moves a key up one group; evict the oldest key of the smallest group.",
  ],
  review: [
    "Every call except keys() is O(1): no indexOf, no sorting, no scanning on the hot path.",
    "One 'use' method updates recency and use counts together, so get and put can't drift apart.",
    "Eviction is one method that asks the policy which key to drop; LFU didn't add if/else to get or put.",
    "A stored 0, \"\" or false comes back as itself, not as a miss.",
    "Invalid input is checked before anything changes.",
    "Names say what things are (uses, buckets, minUses), and the trickiest line has a comment.",
  ],
  walkthrough: {
    design:
      "Two structures kept in step. A map from key to value, ordered by recency, answers get in O(1) and gives the least recently used key at its front. In JavaScript a Map keeps insertion order, so delete-then-set moves a key to the back; in Python an OrderedDict's move_to_end does the same. In an interview without those, use a hash map to nodes of a doubly linked list. LFU adds a bucket per use count, each recency-ordered, plus the smallest count present: a use moves a key from bucket n to n + 1, and eviction takes the front of the smallest bucket. The smallest count only grows by one on a use, and resets to 1 on a new key, so it stays O(1).",
    classes: [
      { name: "MenuCache", role: "Public API: validates, records uses, evicts by the current policy." },
      { name: "values (recency-ordered map)", role: "Key to value, least to most recently used: the LRU order for free." },
      { name: "uses, buckets, minUses", role: "LFU bookkeeping: use counts, keys grouped by count, and the smallest count present." },
    ],
    tradeoffs: [
      "Ordered maps hide the linked list; say so, and be ready to write the node version if the interviewer asks for it.",
      "LFU without decay keeps old favourites forever. Real caches age counts (or use windows, like TinyLFU) so yesterday's hits don't crowd out today's.",
      "Shrinking under LFU may scan the buckets once to find the new smallest count; it's rare, so that's acceptable.",
      "This cache is single-threaded. Shared by many threads, it needs a lock (or sharding by key, each shard with its own lock).",
    ],
    followUps: [
      "Add a time-to-live per key.",
      "Make it thread-safe, then make it fast under contention (sharding).",
      "Count memory instead of items: each value has a size and the capacity is in bytes.",
      "Write the doubly linked list yourself, without an ordered map.",
    ],
  },
};
