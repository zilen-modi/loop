import { randInt, type BuildProblem, type Rand, type Step } from "@/content/problem-types";

/** Sessions and feature flags: sets with and without TTLs, deletes, reads and nested transactions. */
function session(r: Rand, ops: number, withExtension: boolean): Step[] {
  const steps: Step[] = [];
  let t = 0;
  let depth = 0;
  const key = () => `k${randInt(r, 0, 60)}`;
  const value = () => (r() < 0.5 ? `v${randInt(r, 0, 9)}` : randInt(r, 0, 9));
  for (let i = 0; i < ops; i++) {
    t += randInt(r, 0, 6);
    const roll = r();
    if (roll < 0.3) steps.push({ call: "set", args: r() < 0.5 ? [key(), value(), t] : [key(), value(), t, randInt(r, 1, 40)] });
    else if (roll < 0.55) steps.push({ call: "get", args: [key(), t] });
    else if (roll < 0.65) steps.push({ call: "delete", args: [key(), t] });
    else if (roll < 0.72 && depth < 5) {
      steps.push({ call: "begin", args: [] });
      depth++;
    } else if (roll < 0.77) {
      steps.push({ call: "commit", args: [] }); // with no open transaction this must be refused
      depth = Math.max(0, depth - 1);
    } else if (roll < 0.82) {
      steps.push({ call: "rollback", args: [] });
      depth = Math.max(0, depth - 1);
    } else if (withExtension && roll < 0.92) steps.push({ call: "count", args: [value(), t] });
    else if (withExtension && roll < 0.95) steps.push({ call: "items", args: [t] });
    else if (roll < 0.97) steps.push({ call: "get", args: [key(), Math.max(0, t - 3)], note: "time going backwards must be refused" });
    else steps.push({ call: "get", args: [key(), t] });
  }
  return steps;
}

export const kvStore: BuildProblem = {
  kind: "build",
  id: "kv-store",
  chapter: "kv-store",
  n: 1,
  title: "A key-value store with expiry and transactions",
  level: "Hard",
  shape: "Machine coding · undo logs and a min-heap",
  rounds: ["Machine coding"],
  minutes: 90,
  statement: `Tiffin's checkout keeps carts, sessions and feature flags in a small in-memory store. Build \`KVStore\`: string keys, values that can **expire**, and **nested transactions** that can be committed or rolled back.

Time is **passed in** as whole milliseconds and never goes backwards, so tests can say exactly when a key expires.

After the core passes, the interviewer adds two requirements, just as in a real round.`,
  requirements: {
    core: [
      "Set, get and delete values by key; a set can give the key a time-to-live.",
      "Keys expire on time, whether or not anyone reads them.",
      "Begin, commit and roll back transactions, nested to any depth.",
      "Reject invalid input with an error and change nothing.",
    ],
    extension: ["Count the live keys holding a value, in O(1) time.", "List every live key and value, sorted by key."],
  },
  api: [
    { js: "set(key, value, time, ttlMs?)", py: "set(key, value, time, ttl_ms=None)", does: "Returns null. With ttlMs, the key is live while time < set time + ttlMs. Without it, the key never expires (any old expiry is cleared).", stage: "core" },
    { js: "get(key, time)", py: "get(key, time)", does: "The value, or null (None) if absent or expired.", stage: "core" },
    { js: "delete(key, time)", py: "delete(key, time)", does: "true if a live key was removed, else false.", stage: "core" },
    { js: "begin()", py: "begin()", does: "Opens a transaction inside any open ones. Returns the new depth.", stage: "core" },
    { js: "commit()", py: "commit()", does: "Closes the innermost transaction, keeping its changes. Returns the new depth.", stage: "core" },
    { js: "rollback()", py: "rollback()", does: "Closes the innermost transaction, undoing its changes. Returns the new depth.", stage: "core" },
    { js: "count(value, time)", py: "count(value, time)", does: "How many live keys hold exactly this value.", stage: "extension" },
    { js: "items(time)", py: "items(time)", does: "Every live [key, value], sorted by key.", stage: "extension" },
  ],
  rules: [
    "Keys are non-empty strings. Values are strings or numbers; 1 and \"1\" are different values.",
    "A key set at time s with ttlMs = d is live while time < s + d, and gone from s + d on.",
    "Every call with a time takes a whole number ≥ 0 that's never earlier than a time already seen.",
    "Committing the innermost transaction makes its changes part of the one around it: rolling that one back later undoes them too. Committing the outermost makes them permanent.",
    "Rolling back restores every key the transaction changed to what it was at begin(), except values that have expired since: those stay gone.",
    "Expiry ignores transactions: a key that expires is gone at once, inside a transaction or not.",
    "Errors (JavaScript: throw an Error; Python: raise ValueError), changing nothing: a bad key, value, TTL or time; commit or rollback with no open transaction.",
    "count (extension) must not scan the keys: keep counts up to date as values are set, deleted, rolled back and expired.",
  ],
  className: "KVStore",
  starter: {
    js: `class KVStore {
  constructor() {
    // your state here
  }

  set(key, value, time, ttlMs) {
    return null;
  }

  get(key, time) {
    return null;
  }

  delete(key, time) {
    return false;
  }

  begin() {
    return 0;
  }

  commit() {
    return 0;
  }

  rollback() {
    return 0;
  }

  // The interviewer adds more once the core works
}
`,
    py: `class KVStore:
    def __init__(self):
        pass  # your state here

    def set(self, key, value, time, ttl_ms=None):
        return None

    def get(self, key, time):
        return None

    def delete(self, key, time):
        return False

    def begin(self):
        return 0

    def commit(self):
        return 0

    def rollback(self):
        return 0

    # The interviewer adds more once the core works
`,
  },
  solution: {
    js: `// Writes go straight to the store; each open transaction keeps an undo log of what it changed,
// and rollback replays that log backwards. Expiry times sit in a min-heap and are applied as time
// moves forward, so expired keys disappear even if nobody reads them.
class MinHeap {
  constructor() {
    this.a = [];
  }
  get size() {
    return this.a.length;
  }
  peek() {
    return this.a[0];
  }
  push(x) {
    const a = this.a;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

class KVStore {
  constructor() {
    this.store = new Map(); // key → { value, expiresAt } (expiresAt null = never)
    this.counts = new Map(); // value → how many live keys hold it
    this.expiries = new MinHeap(); // [expiresAt, key]
    this.logs = []; // one undo log per open transaction: [key, entry before the change]
    this.now = 0;
  }

  set(key, value, time, ttlMs) {
    this.checkKey(key);
    this.checkTime(time);
    if (typeof value !== "string" && typeof value !== "number") throw new Error("Values are strings or numbers");
    const hasTtl = ttlMs !== undefined && ttlMs !== null;
    if (hasTtl && !(Number.isInteger(ttlMs) && ttlMs >= 1)) throw new Error("A TTL is a whole number of ms, at least 1");
    this.advance(time);
    const expiresAt = hasTtl ? time + ttlMs : null;
    this.write(key, { value, expiresAt });
    if (expiresAt !== null) this.expiries.push([expiresAt, key]);
    return null;
  }

  get(key, time) {
    this.checkKey(key);
    this.checkTime(time);
    this.advance(time);
    const e = this.store.get(key);
    return e === undefined ? null : e.value;
  }

  delete(key, time) {
    this.checkKey(key);
    this.checkTime(time);
    this.advance(time);
    if (!this.store.has(key)) return false;
    this.write(key, null);
    return true;
  }

  begin() {
    this.logs.push([]);
    return this.logs.length;
  }

  commit() {
    if (!this.logs.length) throw new Error("No open transaction");
    const log = this.logs.pop();
    const parent = this.logs[this.logs.length - 1];
    if (parent) for (const change of log) parent.push(change);
    return this.logs.length;
  }

  rollback() {
    if (!this.logs.length) throw new Error("No open transaction");
    const log = this.logs.pop();
    for (let i = log.length - 1; i >= 0; i--) this.put(log[i][0], log[i][1]);
    return this.logs.length;
  }

  // Extension: counts are kept up to date by put(), so this is O(1).
  count(value, time) {
    this.checkTime(time);
    this.advance(time);
    return this.counts.get(value) ?? 0;
  }

  items(time) {
    this.checkTime(time);
    this.advance(time);
    return [...this.store.entries()].map(([k, e]) => [k, e.value]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  }

  // A change made through the API: remember the old entry if a transaction is open.
  write(key, entry) {
    if (this.logs.length) this.logs[this.logs.length - 1].push([key, this.store.get(key) ?? null]);
    this.put(key, entry);
  }

  // Replace a key's entry and keep the counts right. An entry that has already expired is dropped.
  put(key, entry) {
    const old = this.store.get(key);
    if (old) {
      this.store.delete(key);
      const n = this.counts.get(old.value) - 1;
      if (n) this.counts.set(old.value, n);
      else this.counts.delete(old.value);
    }
    if (entry && (entry.expiresAt === null || entry.expiresAt > this.now)) {
      this.store.set(key, entry);
      this.counts.set(entry.value, (this.counts.get(entry.value) ?? 0) + 1);
    }
  }

  // Move the clock and drop everything that has expired by then.
  advance(time) {
    this.now = time;
    while (this.expiries.size && this.expiries.peek()[0] <= time) {
      const [at, key] = this.expiries.pop();
      const e = this.store.get(key);
      if (e && e.expiresAt === at) this.put(key, null); // otherwise it was overwritten since
    }
  }

  checkKey(key) {
    if (typeof key !== "string" || !key) throw new Error("Keys are non-empty strings");
  }

  checkTime(time) {
    if (!Number.isInteger(time) || time < this.now) throw new Error("Time must be whole and never go backwards");
  }
}
`,
    py: `# Writes go straight to the store; each open transaction keeps an undo log of what it changed,
# and rollback replays that log backwards. Expiry times sit in a min-heap and are applied as time
# moves forward, so expired keys disappear even if nobody reads them.
import heapq


def whole(n):
    return isinstance(n, int) and not isinstance(n, bool)


class KVStore:
    def __init__(self):
        self.store = {}  # key -> (value, expires_at or None)
        self.counts = {}  # value -> how many live keys hold it
        self.expiries = []  # heap of (expires_at, key)
        self.logs = []  # one undo log per open transaction: (key, entry before the change)
        self.now = 0

    def set(self, key, value, time, ttl_ms=None):
        self._check_key(key)
        self._check_time(time)
        if isinstance(value, bool) or not isinstance(value, (str, int, float)):
            raise ValueError("Values are strings or numbers")
        if ttl_ms is not None and not (whole(ttl_ms) and ttl_ms >= 1):
            raise ValueError("A TTL is a whole number of ms, at least 1")
        self._advance(time)
        expires_at = time + ttl_ms if ttl_ms is not None else None
        self._write(key, (value, expires_at))
        if expires_at is not None:
            heapq.heappush(self.expiries, (expires_at, key))
        return None

    def get(self, key, time):
        self._check_key(key)
        self._check_time(time)
        self._advance(time)
        e = self.store.get(key)
        return None if e is None else e[0]

    def delete(self, key, time):
        self._check_key(key)
        self._check_time(time)
        self._advance(time)
        if key not in self.store:
            return False
        self._write(key, None)
        return True

    def begin(self):
        self.logs.append([])
        return len(self.logs)

    def commit(self):
        if not self.logs:
            raise ValueError("No open transaction")
        log = self.logs.pop()
        if self.logs:
            self.logs[-1].extend(log)
        return len(self.logs)

    def rollback(self):
        if not self.logs:
            raise ValueError("No open transaction")
        for key, entry in reversed(self.logs.pop()):
            self._put(key, entry)
        return len(self.logs)

    # Extension: counts are kept up to date by _put, so this is O(1).
    def count(self, value, time):
        self._check_time(time)
        self._advance(time)
        return self._counts_get(value)

    def items(self, time):
        self._check_time(time)
        self._advance(time)
        return [[k, self.store[k][0]] for k in sorted(self.store)]

    # Python treats 1 and 1.0 as the same key, which is what we want; "1" stays different.
    def _counts_get(self, value):
        return self.counts.get((type(value) is str, value), 0)

    def _write(self, key, entry):
        if self.logs:
            self.logs[-1].append((key, self.store.get(key)))
        self._put(key, entry)

    def _put(self, key, entry):
        old = self.store.pop(key, None)
        if old is not None:
            k = (type(old[0]) is str, old[0])
            self.counts[k] -= 1
            if not self.counts[k]:
                del self.counts[k]
        if entry is not None and (entry[1] is None or entry[1] > self.now):
            self.store[key] = entry
            k = (type(entry[0]) is str, entry[0])
            self.counts[k] = self.counts.get(k, 0) + 1

    def _advance(self, time):
        self.now = time
        while self.expiries and self.expiries[0][0] <= time:
            at, key = heapq.heappop(self.expiries)
            e = self.store.get(key)
            if e is not None and e[1] == at:
                self._put(key, None)

    def _check_key(self, key):
        if not isinstance(key, str) or not key:
            raise ValueError("Keys are non-empty strings")

    def _check_time(self, time):
        if not whole(time) or time < self.now:
            raise ValueError("Time must be whole and never go backwards")
`,
  },
  scenarios: [
    {
      name: "Set, get and delete",
      stage: "core",
      visible: true,
      steps: [
        { call: "set", args: ["cart:7", "2 thalis", 0], expect: null },
        { call: "get", args: ["cart:7", 0], expect: "2 thalis" },
        { call: "delete", args: ["cart:7", 1], expect: true },
        { call: "get", args: ["cart:7", 1], expect: null },
        { call: "delete", args: ["cart:7", 2], expect: false },
        { call: "set", args: ["count", 0, 3] },
        { call: "get", args: ["count", 3], expect: 0, note: "a stored 0 is a value, not a miss" },
      ],
    },
    {
      name: "Keys expire on time",
      stage: "core",
      visible: true,
      steps: [
        { call: "set", args: ["session", "asha", 100, 50] },
        { call: "get", args: ["session", 149], expect: "asha" },
        { call: "get", args: ["session", 150], expect: null, note: "live while time < 100 + 50" },
        { call: "delete", args: ["session", 151], expect: false },
        { call: "set", args: ["session", "bilal", 200, 1] },
        { call: "get", args: ["session", 200], expect: "bilal" },
        { call: "get", args: ["session", 201], expect: null },
      ],
    },
    {
      name: "Nested transactions",
      stage: "core",
      visible: true,
      steps: [
        { call: "begin", args: [], expect: 1 },
        { call: "set", args: ["a", 1, 0] },
        { call: "begin", args: [], expect: 2 },
        { call: "set", args: ["a", 2, 0] },
        { call: "get", args: ["a", 0], expect: 2 },
        { call: "rollback", args: [], expect: 1 },
        { call: "get", args: ["a", 0], expect: 1 },
        { call: "commit", args: [], expect: 0 },
        { call: "get", args: ["a", 0], expect: 1 },
        { call: "rollback", args: [], throws: true },
      ],
    },
    {
      name: "Committing an inner transaction hands its changes to the outer one",
      stage: "core",
      steps: [
        { call: "begin", args: [] },
        { call: "set", args: ["a", 1, 0] },
        { call: "begin", args: [] },
        { call: "set", args: ["a", 2, 0] },
        { call: "set", args: ["b", 3, 0] },
        { call: "commit", args: [], expect: 1 },
        { call: "get", args: ["a", 0], expect: 2 },
        { call: "rollback", args: [], expect: 0 },
        { call: "get", args: ["a", 0], expect: null, note: "the outer rollback undoes the inner commit too" },
        { call: "get", args: ["b", 0], expect: null },
      ],
    },
    {
      name: "Rollback can't bring back what has expired",
      stage: "core",
      steps: [
        { call: "set", args: ["a", "old", 0, 100] },
        { call: "begin", args: [] },
        { call: "set", args: ["a", "new", 10] },
        { call: "get", args: ["a", 50], expect: "new" },
        { call: "rollback", args: [] },
        { call: "get", args: ["a", 60], expect: "old", note: "restored, and still within its TTL" },
        { call: "get", args: ["a", 100], expect: null },
        { call: "set", args: ["c", "x", 200, 10] },
        { call: "begin", args: [] },
        { call: "set", args: ["c", "z", 201] },
        { call: "get", args: ["c", 300], expect: "z", note: "no TTL on the new value" },
        { call: "rollback", args: [] },
        { call: "get", args: ["c", 300], expect: null, note: "the old value expired at 210: it stays gone" },
      ],
    },
    {
      name: "Deletes inside transactions",
      stage: "core",
      steps: [
        { call: "set", args: ["flag:new-checkout", "on", 0] },
        { call: "begin", args: [] },
        { call: "delete", args: ["flag:new-checkout", 5], expect: true },
        { call: "get", args: ["flag:new-checkout", 5], expect: null },
        { call: "delete", args: ["flag:new-checkout", 6], expect: false },
        { call: "rollback", args: [] },
        { call: "get", args: ["flag:new-checkout", 7], expect: "on" },
      ],
    },
    {
      name: "A set without a TTL clears the old one",
      stage: "core",
      steps: [
        { call: "set", args: ["a", 1, 0, 10] },
        { call: "set", args: ["a", 2, 5] },
        { call: "get", args: ["a", 1000], expect: 2 },
        { call: "set", args: ["b", 1, 1000, 10] },
        { call: "set", args: ["b", 2, 1005, 100] },
        { call: "get", args: ["b", 1010], expect: 2, note: "the first expiry no longer applies" },
        { call: "get", args: ["b", 1105], expect: null },
      ],
    },
    {
      name: "Expiry inside a transaction, then commit",
      stage: "core",
      steps: [
        { call: "begin", args: [] },
        { call: "set", args: ["otp", 4821, 0, 5] },
        { call: "commit", args: [], expect: 0 },
        { call: "get", args: ["otp", 4], expect: 4821 },
        { call: "get", args: ["otp", 5], expect: null },
      ],
    },
    {
      name: "Bad input is rejected and changes nothing",
      stage: "core",
      steps: [
        { call: "get", args: ["", 0], throws: true },
        { call: "set", args: ["a", null, 0], throws: true },
        { call: "set", args: ["a", 1, 0, 0], throws: true },
        { call: "set", args: ["a", 1, 0, 1.5], throws: true },
        { call: "set", args: ["a", 1, -1], throws: true },
        { call: "commit", args: [], throws: true },
        { call: "rollback", args: [], throws: true },
        { call: "set", args: ["a", 1, 10] },
        { call: "get", args: ["a", 5], throws: true },
        { call: "set", args: ["a", 9, 5], throws: true },
        { call: "get", args: ["a", 10], expect: 1 },
        { call: "begin", args: [], expect: 1 },
        { call: "set", args: ["a", 2, 10, -5], throws: true },
        { call: "rollback", args: [], expect: 0 },
        { call: "get", args: ["a", 10], expect: 1 },
      ],
    },
    {
      name: "Counting values",
      stage: "extension",
      visible: true,
      steps: [
        { call: "set", args: ["a", "veg", 0] },
        { call: "set", args: ["b", "veg", 0] },
        { call: "set", args: ["c", "non-veg", 0] },
        { call: "count", args: ["veg", 0], expect: 2 },
        { call: "set", args: ["b", "non-veg", 1] },
        { call: "count", args: ["veg", 1], expect: 1 },
        { call: "count", args: ["non-veg", 1], expect: 2 },
        { call: "begin", args: [] },
        { call: "set", args: ["a", "non-veg", 2] },
        { call: "count", args: ["non-veg", 2], expect: 3 },
        { call: "rollback", args: [] },
        { call: "count", args: ["non-veg", 3], expect: 2 },
        { call: "count", args: ["vegan", 3], expect: 0 },
      ],
    },
    {
      name: "Listing everything, sorted",
      stage: "extension",
      visible: true,
      steps: [
        { call: "set", args: ["b", 2, 0] },
        { call: "set", args: ["a", 1, 0] },
        { call: "set", args: ["c", "3", 0, 10] },
        { call: "items", args: [0], expect: [["a", 1], ["b", 2], ["c", "3"]] },
        { call: "items", args: [10], expect: [["a", 1], ["b", 2]] },
      ],
    },
    {
      name: "Counts follow expiry, without anyone reading the key",
      stage: "extension",
      steps: [
        { call: "set", args: ["x", "hot", 0, 10] },
        { call: "set", args: ["y", "hot", 0, 20] },
        { call: "count", args: ["hot", 9], expect: 2 },
        { call: "count", args: ["hot", 10], expect: 1 },
        { call: "count", args: ["hot", 20], expect: 0 },
        { call: "items", args: [20], expect: [] },
      ],
    },
    {
      name: "1 and \"1\" are counted separately",
      stage: "extension",
      steps: [
        { call: "set", args: ["a", 1, 0] },
        { call: "set", args: ["b", "1", 0] },
        { call: "set", args: ["c", 1, 0] },
        { call: "count", args: [1, 0], expect: 2 },
        { call: "count", args: ["1", 0], expect: 1 },
        { call: "delete", args: ["a", 1] },
        { call: "count", args: [1, 1], expect: 1 },
      ],
    },
  ],
  generated: [
    { name: "Sessions: 3,000 sets, reads, deletes and nested transactions", stage: "core", limitMs: 2000, gen: (r) => session(r, 3000, false) },
    { name: "With counts and listings: 3,000 operations", stage: "extension", limitMs: 2000, gen: (r) => session(r, 3000, true) },
  ],
  mutants: [
    { name: "Rollback brings back values that have expired", from: "if (entry && (entry.expiresAt === null || entry.expiresAt > this.now)) {", to: "if (entry) {" },
    { name: "A key is still live at its expiry time", from: "this.expiries.peek()[0] <= time", to: "this.expiries.peek()[0] < time" },
    { name: "Committing an inner transaction forgets its changes", from: "    if (parent) for (const change of log) parent.push(change);\n", to: "" },
    { name: "Expiry doesn't update the counts", from: "if (e && e.expiresAt === at) this.put(key, null);", to: "if (e && e.expiresAt === at) this.store.delete(key);" },
    { name: "A set without a TTL keeps the old expiry", from: "const expiresAt = hasTtl ? time + ttlMs : null;", to: "const expiresAt = hasTtl ? time + ttlMs : (this.store.get(key)?.expiresAt ?? null);" },
    { name: "Treats a stored 0 as a miss", from: "return e === undefined ? null : e.value;", to: "return (e && e.value) || null;" },
  ],
  hints: [
    "Two separate questions: how do you undo a transaction, and how do keys expire when nobody touches them? Answer each with its own small structure.",
    "For transactions, either keep each transaction's changes in a layer on top of the store, or write straight to the store and keep an undo log (key, value before) per transaction. The undo log makes reads and counts O(1). For expiry, keep (expiry time, key) pairs in a min-heap and pop everything due whenever time moves.",
    "set: validate, advance the clock (pop the heap), log the old entry if a transaction is open, write. rollback: replay the log backwards, skipping old values that have expired by now. commit: append the inner log to the outer one (or drop it at the top level). count: update a value → count map in the one function that changes entries.",
  ],
  review: [
    "One function changes entries (and the counts); set, delete, rollback and expiry all go through it.",
    "Undo logs are per transaction, and an inner commit appends to the outer log, so an outer rollback still works.",
    "Expiry is driven by a min-heap and the clock, not by reads; a stale heap entry (overwritten key) is skipped.",
    "Every input is validated before the clock moves or anything is written.",
    "count never scans the keys.",
    "Names say what things are (logs, expiries, advance), and the rollback rule about expired values has a comment.",
  ],
  walkthrough: {
    design:
      "Writes go straight into the store, and each open transaction keeps an undo log of (key, entry before the change). Rollback replays its log backwards. Commit appends its log to the transaction outside it, so rolling that one back later undoes everything; at the top level the log is simply dropped. Expiry needs no reads: (expiry time, key) pairs sit in a min-heap, and whenever time moves forward everything due is popped and removed, skipping entries that were overwritten since. All changes go through one put() that also keeps a value-to-count map, which makes count O(1) and keeps it right through rollbacks and expiries.",
    classes: [
      { name: "KVStore", role: "Public API: validates, moves the clock, logs and applies changes." },
      { name: "store and counts", role: "Live key → (value, expiry), and value → number of live keys holding it." },
      { name: "logs (one per transaction)", role: "Undo information: the entry each key had before this transaction changed it." },
      { name: "MinHeap of expiries", role: "Pops keys as they expire, so expiry doesn't depend on reads." },
    ],
    tradeoffs: [
      "Undo logs make reads O(1) and writes cheap; the alternative, a stack of change layers, makes commit cheap but every read walks the layers.",
      "Expiring through a heap is O(log n) per key; Redis instead samples random keys with TTLs and expires lazily on access, trading exactness for less work.",
      "An overwritten key leaves a stale heap entry that's skipped later; with heavy overwrites, compact the heap now and then.",
      "Real stores make transactions isolated between clients (locks or MVCC); this one is for a single client.",
    ],
    followUps: [
      "Return a key's remaining TTL.",
      "Make transactions isolated between two concurrent clients.",
      "Persist the store: an append-only log of commands, replayed on start.",
      "Cap memory and evict with LRU when full (chapter 20).",
    ],
  },
};
