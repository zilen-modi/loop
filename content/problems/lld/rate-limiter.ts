import { randInt, type BuildProblem, type Rand, type Step } from "@/content/problem-types";

/** Many clients, bursty traffic, the clock only moving forward; some queries and bad calls mixed in. */
function traffic(r: Rand, clients: number, requests: number, mode: "bucket" | "partners" | "window"): Step[] {
  const steps: Step[] = [];
  if (mode === "window") steps.push({ call: "useSlidingWindow", args: [20, 2000] });
  else steps.push({ call: "configure", args: [10, 5] });
  const ids = Array.from({ length: clients }, (_, i) => `app-${i}`);
  if (mode === "partners") for (let i = 0; i < clients; i += 25) steps.push({ call: "setLimit", args: [ids[i], 50, 40] });
  let t = 0;
  for (let i = 0; i < requests; i++) {
    t += r() < 0.7 ? 0 : randInt(r, 1, 40); // bursts: many requests at the same millisecond
    const id = ids[Math.floor(clients * Math.pow(r(), 1.8))]; // a few clients are much busier
    const roll = r();
    if (roll < 0.9) steps.push({ call: "allow", args: [id, t] });
    else if (roll < 0.95) steps.push({ call: "remaining", args: [id, t] });
    else if (roll < 0.99) steps.push({ call: "retryAfter", args: [id, t] });
    else steps.push({ call: "allow", args: [id, Math.max(0, t - 5)], note: "time going backwards must be refused" });
    if (mode === "partners" && r() < 0.0005) steps.push({ call: "setLimit", args: [id, randInt(r, 1, 30), randInt(r, 1, 20)] });
  }
  return steps;
}

export const rateLimiter: BuildProblem = {
  kind: "build",
  id: "rate-limiter",
  chapter: "rate-limiter",
  n: 1,
  title: "A rate limiter for the partner API",
  level: "Medium",
  shape: "Machine coding · token bucket, then sliding window",
  rounds: ["Machine coding"],
  minutes: 60,
  statement: `Restaurant partners call Tiffin's API to update menus and prices. One buggy integration sent 40,000 requests in a minute and slowed everyone down. Build \`RateLimiter\`, which decides for each request whether a partner (the *client*) may go ahead.

Time is **passed in** as whole milliseconds on every call, so tests can say exactly when each request arrives. The clock never goes backwards.

After the core passes, the interviewer adds two requirements, just as in a real round.`,
  requirements: {
    core: [
      "Configure a token bucket: a capacity (the biggest burst) and a refill rate in tokens per second.",
      "Allow or refuse a request from a client at a given time; each client has its own bucket.",
      "Report how many whole requests a client could make right now, and how long until the next one is allowed.",
      "Reject invalid input with an error and change nothing.",
    ],
    extension: ["Per-client limits for partners on a bigger plan.", "A second algorithm: a sliding-window log (at most N requests in any window of W ms)."],
  },
  api: [
    { js: "configure(capacity, perSecond)", py: "configure(capacity, per_second)", does: "Whole numbers ≥ 1. Only before the first allow().", stage: "core" },
    { js: "allow(client, time)", py: "allow(client, time)", does: "true and uses a token if one is available, else false.", stage: "core" },
    { js: "remaining(client, time)", py: "remaining(client, time)", does: "Whole tokens available now (a client not seen yet has a full bucket).", stage: "core" },
    { js: "retryAfter(client, time)", py: "retry_after(client, time)", does: "Milliseconds until a request would be allowed; 0 if one would be allowed now.", stage: "core" },
    { js: "setLimit(client, capacity, perSecond)", py: "set_limit(client, capacity, per_second)", does: "A client's own bucket size and rate (token bucket only).", stage: "extension" },
    { js: "useSlidingWindow(limit, windowMs)", py: "use_sliding_window(limit, window_ms)", does: "Switch every client to a sliding-window log. Only before the first allow().", stage: "extension" },
  ],
  rules: [
    "A client's bucket starts full the first time it calls allow(). A refused request uses nothing.",
    "Refill is continuous: after t ms a bucket gains t × perSecond ÷ 1000 tokens, fractions included, up to its capacity. A request needs one whole token.",
    "retryAfter is the time until the bucket reaches one whole token, rounded up to a whole millisecond.",
    "Every time argument is a whole number ≥ 0 and never earlier than any time seen before, in any call.",
    "Errors (JavaScript: throw an Error; Python: raise ValueError), changing nothing: allow, remaining or retryAfter before any configuration; bad numbers; an empty client; a time that's negative, not whole, or earlier than one already seen; configuring after the first allow().",
    "setLimit (extension) applies to that client from now on: its tokens are capped at the new capacity, and time not yet refilled counts at the new rate.",
    "Sliding window (extension): a request at time t is allowed if fewer than `limit` requests were allowed in (t − windowMs, t]. A request exactly windowMs old no longer counts. Refused requests aren't logged. retryAfter is when the oldest logged request leaves the window.",
    "setLimit while using the sliding window is an error.",
  ],
  className: "RateLimiter",
  starter: {
    js: `class RateLimiter {
  constructor() {
    // your state here
  }

  configure(capacity, perSecond) {}

  allow(client, time) {
    return true;
  }

  remaining(client, time) {
    return 0;
  }

  retryAfter(client, time) {
    return 0;
  }

  // The interviewer adds more once the core works
}
`,
    py: `class RateLimiter:
    def __init__(self):
        pass  # your state here

    def configure(self, capacity, per_second):
        pass

    def allow(self, client, time):
        return True

    def remaining(self, client, time):
        return 0

    def retry_after(self, client, time):
        return 0

    # The interviewer adds more once the core works
`,
  },
  solution: {
    js: `// Each algorithm is a small class with the same four methods, so the limiter doesn't care which
// one a client uses. Buckets count thousandths of a token, so refill is exact integer arithmetic.
class TokenBucket {
  constructor(capacity, perSecond, now) {
    this.capacity = capacity;
    this.perSecond = perSecond;
    this.milli = capacity * 1000;
    this.last = now;
  }
  refill(now) {
    this.milli = Math.min(this.capacity * 1000, this.milli + (now - this.last) * this.perSecond);
    this.last = now;
  }
  tryTake(now) {
    this.refill(now);
    if (this.milli < 1000) return false;
    this.milli -= 1000;
    return true;
  }
  remaining(now) {
    this.refill(now);
    return Math.floor(this.milli / 1000);
  }
  retryAfter(now) {
    this.refill(now);
    return this.milli >= 1000 ? 0 : Math.ceil((1000 - this.milli) / this.perSecond);
  }
  resize(capacity, perSecond) {
    this.capacity = capacity;
    this.perSecond = perSecond;
    this.milli = Math.min(this.milli, capacity * 1000);
  }
}

class SlidingLog {
  constructor(limit, windowMs) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.times = []; // allowed requests; times[head..] are still in the window
    this.head = 0;
  }
  count(now) {
    while (this.head < this.times.length && this.times[this.head] <= now - this.windowMs) this.head++;
    if (this.head > 1024 && this.head * 2 > this.times.length) {
      this.times = this.times.slice(this.head);
      this.head = 0;
    }
    return this.times.length - this.head;
  }
  tryTake(now) {
    if (this.count(now) >= this.limit) return false;
    this.times.push(now);
    return true;
  }
  remaining(now) {
    return this.limit - this.count(now);
  }
  retryAfter(now) {
    return this.count(now) < this.limit ? 0 : this.times[this.head] + this.windowMs - now;
  }
}

const whole = (n, min) => Number.isInteger(n) && n >= min;

class RateLimiter {
  constructor() {
    this.limits = null; // { kind: "bucket", capacity, perSecond } or { kind: "window", limit, windowMs }
    this.overrides = new Map(); // client → { capacity, perSecond }
    this.clients = new Map(); // client → TokenBucket or SlidingLog
    this.now = 0;
    this.started = false;
  }

  configure(capacity, perSecond) {
    if (!whole(capacity, 1) || !whole(perSecond, 1)) throw new Error("Capacity and rate must be whole numbers ≥ 1");
    if (this.started) throw new Error("Configure before the first request");
    this.limits = { kind: "bucket", capacity, perSecond };
  }

  useSlidingWindow(limit, windowMs) {
    if (!whole(limit, 1) || !whole(windowMs, 1)) throw new Error("Limit and window must be whole numbers ≥ 1");
    if (this.started) throw new Error("Choose the algorithm before the first request");
    this.limits = { kind: "window", limit, windowMs };
  }

  setLimit(client, capacity, perSecond) {
    if (!this.limits || this.limits.kind !== "bucket") throw new Error("Per-client limits need a token bucket");
    if (typeof client !== "string" || !client) throw new Error("Bad client");
    if (!whole(capacity, 1) || !whole(perSecond, 1)) throw new Error("Capacity and rate must be whole numbers ≥ 1");
    this.overrides.set(client, { capacity, perSecond });
    this.clients.get(client)?.resize(capacity, perSecond);
  }

  allow(client, time) {
    this.check(client, time);
    this.started = true;
    return this.limiterFor(client, time).tryTake(time);
  }

  remaining(client, time) {
    this.check(client, time);
    const l = this.clients.get(client);
    if (l) return l.remaining(time);
    return this.limits.kind === "window" ? this.limits.limit : (this.overrides.get(client) ?? this.limits).capacity;
  }

  retryAfter(client, time) {
    this.check(client, time);
    const l = this.clients.get(client);
    return l ? l.retryAfter(time) : 0;
  }

  // Validates everything first, then moves the clock.
  check(client, time) {
    if (!this.limits) throw new Error("Configure the limiter first");
    if (typeof client !== "string" || !client) throw new Error("Bad client");
    if (!whole(time, 0) || time < this.now) throw new Error("Time must be whole and never go backwards");
    this.now = time;
  }

  limiterFor(client, time) {
    if (!this.clients.has(client)) {
      const l = this.limits;
      const own = this.overrides.get(client) ?? l;
      this.clients.set(client, l.kind === "window" ? new SlidingLog(l.limit, l.windowMs) : new TokenBucket(own.capacity, own.perSecond, time));
    }
    return this.clients.get(client);
  }
}
`,
    py: `# Each algorithm is a small class with the same four methods, so the limiter doesn't care which
# one a client uses. Buckets count thousandths of a token, so refill is exact integer arithmetic.
from collections import deque


class TokenBucket:
    def __init__(self, capacity, per_second, now):
        self.capacity = capacity
        self.per_second = per_second
        self.milli = capacity * 1000
        self.last = now

    def refill(self, now):
        self.milli = min(self.capacity * 1000, self.milli + (now - self.last) * self.per_second)
        self.last = now

    def try_take(self, now):
        self.refill(now)
        if self.milli < 1000:
            return False
        self.milli -= 1000
        return True

    def remaining(self, now):
        self.refill(now)
        return self.milli // 1000

    def retry_after(self, now):
        self.refill(now)
        return 0 if self.milli >= 1000 else -(-(1000 - self.milli) // self.per_second)

    def resize(self, capacity, per_second):
        self.capacity = capacity
        self.per_second = per_second
        self.milli = min(self.milli, capacity * 1000)


class SlidingLog:
    def __init__(self, limit, window_ms):
        self.limit = limit
        self.window_ms = window_ms
        self.times = deque()  # allowed requests still in the window

    def count(self, now):
        while self.times and self.times[0] <= now - self.window_ms:
            self.times.popleft()
        return len(self.times)

    def try_take(self, now):
        if self.count(now) >= self.limit:
            return False
        self.times.append(now)
        return True

    def remaining(self, now):
        return self.limit - self.count(now)

    def retry_after(self, now):
        return 0 if self.count(now) < self.limit else self.times[0] + self.window_ms - now


def whole(n, least):
    return isinstance(n, int) and not isinstance(n, bool) and n >= least


class RateLimiter:
    def __init__(self):
        self.limits = None  # ("bucket", capacity, per_second) or ("window", limit, window_ms)
        self.overrides = {}  # client -> (capacity, per_second)
        self.clients = {}  # client -> TokenBucket or SlidingLog
        self.now = 0
        self.started = False

    def configure(self, capacity, per_second):
        if not whole(capacity, 1) or not whole(per_second, 1):
            raise ValueError("Capacity and rate must be whole numbers >= 1")
        if self.started:
            raise ValueError("Configure before the first request")
        self.limits = ("bucket", capacity, per_second)

    def use_sliding_window(self, limit, window_ms):
        if not whole(limit, 1) or not whole(window_ms, 1):
            raise ValueError("Limit and window must be whole numbers >= 1")
        if self.started:
            raise ValueError("Choose the algorithm before the first request")
        self.limits = ("window", limit, window_ms)

    def set_limit(self, client, capacity, per_second):
        if not self.limits or self.limits[0] != "bucket":
            raise ValueError("Per-client limits need a token bucket")
        if not isinstance(client, str) or not client:
            raise ValueError("Bad client")
        if not whole(capacity, 1) or not whole(per_second, 1):
            raise ValueError("Capacity and rate must be whole numbers >= 1")
        self.overrides[client] = (capacity, per_second)
        if client in self.clients:
            self.clients[client].resize(capacity, per_second)

    def allow(self, client, time):
        self._check(client, time)
        self.started = True
        return self._limiter_for(client, time).try_take(time)

    def remaining(self, client, time):
        self._check(client, time)
        if client in self.clients:
            return self.clients[client].remaining(time)
        if self.limits[0] == "window":
            return self.limits[1]
        return self.overrides.get(client, self.limits[1:])[0]

    def retry_after(self, client, time):
        self._check(client, time)
        return self.clients[client].retry_after(time) if client in self.clients else 0

    def _check(self, client, time):
        if not self.limits:
            raise ValueError("Configure the limiter first")
        if not isinstance(client, str) or not client:
            raise ValueError("Bad client")
        if not whole(time, 0) or time < self.now:
            raise ValueError("Time must be whole and never go backwards")
        self.now = time

    def _limiter_for(self, client, time):
        if client not in self.clients:
            kind, a, b = self.limits
            if kind == "window":
                self.clients[client] = SlidingLog(a, b)
            else:
                capacity, per_second = self.overrides.get(client, (a, b))
                self.clients[client] = TokenBucket(capacity, per_second, time)
        return self.clients[client]
`,
  },
  scenarios: [
    {
      name: "A burst, then one per second",
      stage: "core",
      visible: true,
      steps: [
        { call: "configure", args: [3, 1] },
        { call: "allow", args: ["a", 0], expect: true },
        { call: "allow", args: ["a", 0], expect: true },
        { call: "allow", args: ["a", 0], expect: true },
        { call: "allow", args: ["a", 0], expect: false, note: "the burst of 3 is used up" },
        { call: "remaining", args: ["a", 0], expect: 0 },
        { call: "retryAfter", args: ["a", 0], expect: 1000 },
        { call: "allow", args: ["a", 999], expect: false },
        { call: "allow", args: ["a", 1000], expect: true, note: "exactly one second later, exactly one token" },
        { call: "allow", args: ["a", 1000], expect: false },
      ],
    },
    {
      name: "Each client has its own bucket",
      stage: "core",
      visible: true,
      steps: [
        { call: "configure", args: [1, 1] },
        { call: "allow", args: ["a", 0], expect: true },
        { call: "allow", args: ["b", 0], expect: true },
        { call: "allow", args: ["a", 0], expect: false },
        { call: "remaining", args: ["b", 0], expect: 0 },
        { call: "remaining", args: ["c", 0], expect: 1, note: "a client not seen yet has a full bucket" },
      ],
    },
    {
      name: "Refill keeps fractions of a token",
      stage: "core",
      visible: true,
      steps: [
        { call: "configure", args: [2, 2] },
        { call: "allow", args: ["a", 0], expect: true },
        { call: "allow", args: ["a", 0], expect: true },
        { call: "allow", args: ["a", 300], expect: false, note: "0.6 tokens" },
        { call: "allow", args: ["a", 600], expect: true, note: "1.2 tokens: the 0.6 from earlier wasn't lost" },
        { call: "allow", args: ["a", 700], expect: false },
        { call: "retryAfter", args: ["a", 700], expect: 300, note: "0.4 tokens now; 0.6 more takes 300 ms" },
        { call: "allow", args: ["a", 1000], expect: true },
      ],
    },
    {
      name: "The bucket never holds more than its capacity",
      stage: "core",
      steps: [
        { call: "configure", args: [2, 10] },
        { call: "allow", args: ["a", 0], expect: true },
        { call: "allow", args: ["a", 0], expect: true },
        { call: "remaining", args: ["a", 100000], expect: 2 },
        { call: "allow", args: ["a", 100000], expect: true },
        { call: "allow", args: ["a", 100000], expect: true },
        { call: "allow", args: ["a", 100000], expect: false },
      ],
    },
    {
      name: "Retry times round up",
      stage: "core",
      steps: [
        { call: "configure", args: [1, 3] },
        { call: "retryAfter", args: ["a", 0], expect: 0 },
        { call: "allow", args: ["a", 0], expect: true },
        { call: "retryAfter", args: ["a", 0], expect: 334, note: "a third of a second is 333.3 ms" },
        { call: "allow", args: ["a", 333], expect: false },
        { call: "allow", args: ["a", 334], expect: true },
      ],
    },
    {
      name: "Queries don't use tokens",
      stage: "core",
      steps: [
        { call: "configure", args: [5, 1] },
        { call: "remaining", args: ["x", 10], expect: 5 },
        { call: "retryAfter", args: ["x", 10], expect: 0 },
        { call: "allow", args: ["x", 20], expect: true },
        { call: "remaining", args: ["x", 20], expect: 4 },
        { call: "remaining", args: ["x", 20], expect: 4 },
        { call: "allow", args: ["x", 20], expect: true },
        { call: "remaining", args: ["x", 1020], expect: 4 },
      ],
    },
    {
      name: "Bad input is rejected and changes nothing",
      stage: "core",
      steps: [
        { call: "allow", args: ["a", 0], throws: true },
        { call: "configure", args: [0, 1], throws: true },
        { call: "configure", args: [2, 0], throws: true },
        { call: "configure", args: [1.5, 1], throws: true },
        { call: "configure", args: [2, 1] },
        { call: "allow", args: ["", 0], throws: true },
        { call: "allow", args: ["a", -1], throws: true },
        { call: "allow", args: ["a", 0.5], throws: true },
        { call: "allow", args: ["a", 100], expect: true },
        { call: "allow", args: ["a", 50], throws: true },
        { call: "remaining", args: ["b", 99], throws: true, note: "earlier than a time already seen, even for another client" },
        { call: "remaining", args: ["a", 100], expect: 1 },
        { call: "configure", args: [5, 5], throws: true },
        { call: "allow", args: ["a", 100], expect: true, note: "still the original 2-token bucket" },
        { call: "allow", args: ["a", 100], expect: false },
      ],
    },
    {
      name: "Many requests in the same millisecond",
      stage: "core",
      steps: [
        { call: "configure", args: [4, 1] },
        ...Array.from({ length: 6 }, (_, i): Step => ({ call: "allow", args: ["burst", 7], expect: i < 4 })),
        { call: "retryAfter", args: ["burst", 7], expect: 1000 },
        { call: "allow", args: ["burst", 1006], expect: false, note: "999 ms is 0.999 of a token" },
        { call: "allow", args: ["burst", 1007], expect: true },
      ],
    },
    {
      name: "A partner on a bigger plan",
      stage: "extension",
      visible: true,
      steps: [
        { call: "configure", args: [2, 1] },
        { call: "setLimit", args: ["partner", 5, 10] },
        ...Array.from({ length: 6 }, (_, i): Step => ({ call: "allow", args: ["partner", 0], expect: i < 5 })),
        { call: "retryAfter", args: ["partner", 0], expect: 100 },
        { call: "allow", args: ["small", 0], expect: true },
        { call: "allow", args: ["small", 0], expect: true },
        { call: "allow", args: ["small", 0], expect: false },
      ],
    },
    {
      name: "Changing a client's limit mid-way",
      stage: "extension",
      steps: [
        { call: "configure", args: [5, 1] },
        { call: "allow", args: ["a", 0], expect: true },
        { call: "setLimit", args: ["a", 2, 1] },
        { call: "remaining", args: ["a", 0], expect: 2, note: "4 tokens, capped at the new capacity of 2" },
        { call: "allow", args: ["a", 0] },
        { call: "allow", args: ["a", 0] },
        { call: "setLimit", args: ["a", 2, 4] },
        { call: "retryAfter", args: ["a", 0], expect: 250 },
        { call: "allow", args: ["a", 250], expect: true },
        { call: "setLimit", args: ["a", 0, 4], throws: true },
        { call: "setLimit", args: ["", 3, 4], throws: true },
      ],
    },
    {
      name: "A sliding window",
      stage: "extension",
      visible: true,
      steps: [
        { call: "useSlidingWindow", args: [2, 1000] },
        { call: "allow", args: ["a", 0], expect: true },
        { call: "allow", args: ["a", 500], expect: true },
        { call: "allow", args: ["a", 999], expect: false },
        { call: "retryAfter", args: ["a", 999], expect: 1, note: "the request at 0 leaves the window at 1000" },
        { call: "allow", args: ["a", 1000], expect: true, note: "the window is (0, 1000]: the request at 0 no longer counts" },
        { call: "allow", args: ["a", 1000], expect: false },
        { call: "remaining", args: ["a", 1499], expect: 0 },
        { call: "remaining", args: ["a", 1500], expect: 1 },
      ],
    },
    {
      name: "Sliding-window rules",
      stage: "extension",
      steps: [
        { call: "useSlidingWindow", args: [0, 1000], throws: true },
        { call: "useSlidingWindow", args: [3, 60000] },
        { call: "setLimit", args: ["a", 5, 5], throws: true, note: "per-client limits are for token buckets" },
        { call: "allow", args: ["a", 0], expect: true },
        { call: "allow", args: ["a", 1], expect: true },
        { call: "allow", args: ["a", 2], expect: true },
        { call: "allow", args: ["a", 3], expect: false },
        { call: "allow", args: ["a", 4], expect: false },
        { call: "retryAfter", args: ["a", 5], expect: 59995, note: "refused requests aren't logged, so the oldest is still the one at 0" },
        { call: "useSlidingWindow", args: [5, 1000], throws: true },
        { call: "configure", args: [5, 5], throws: true },
        { call: "remaining", args: ["new", 10], expect: 3 },
      ],
    },
    {
      name: "Configure, then switch algorithms before any traffic",
      stage: "extension",
      steps: [
        { call: "configure", args: [1, 1] },
        { call: "useSlidingWindow", args: [2, 100] },
        { call: "allow", args: ["a", 0], expect: true },
        { call: "allow", args: ["a", 0], expect: true },
        { call: "allow", args: ["a", 0], expect: false },
        { call: "allow", args: ["a", 100], expect: true },
      ],
    },
  ],
  generated: [
    { name: "300 clients, 20,000 bursty requests", stage: "core", limitMs: 2000, gen: (r) => traffic(r, 300, 20_000, "bucket") },
    { name: "Partners with their own limits, 20,000 requests", stage: "extension", limitMs: 2000, gen: (r) => traffic(r, 300, 20_000, "partners") },
    { name: "A sliding window, 300 clients, 20,000 requests", stage: "extension", limitMs: 2000, gen: (r) => traffic(r, 300, 20_000, "window") },
  ],
  mutants: [
    { name: "Loses the fraction of a token on every call", from: "this.milli + (now - this.last) * this.perSecond)", to: "Math.floor((this.milli + (now - this.last) * this.perSecond) / 1000) * 1000)" },
    { name: "Rounds retry times down", from: "Math.ceil((1000 - this.milli) / this.perSecond)", to: "Math.floor((1000 - this.milli) / this.perSecond)" },
    { name: "New clients start with an empty bucket", from: "    this.milli = capacity * 1000;\n    this.last = now;", to: "    this.milli = 0;\n    this.last = now;" },
    { name: "The window includes its left edge", from: "this.times[this.head] <= now - this.windowMs", to: "this.times[this.head] < now - this.windowMs" },
    { name: "Refused requests are logged too", from: "    if (this.count(now) >= this.limit) return false;\n    this.times.push(now);", to: "    const full = this.count(now) >= this.limit;\n    this.times.push(now);\n    if (full) return false;" },
    { name: "Doesn't check that time moves forward", from: " || time < this.now)", to: ")" },
  ],
  hints: [
    "What does each client need to remember? For a token bucket, only two numbers: how many tokens it had, and when you last worked that out. You never need a timer.",
    "On every call, first top the bucket up for the time that passed (capped at its capacity), then answer. To keep it exact, count thousandths of a token as whole numbers. Put each algorithm in its own small class with the same methods.",
    "allow: validate, refill, take 1000 if you have it. retryAfter: (1000 − what you have) ÷ rate, rounded up. Sliding window: keep the times of allowed requests in a queue, drop those at or before t − W from the front, and compare the length with the limit.",
  ],
  review: [
    "Each algorithm is its own class with the same methods; the limiter picks one per client and never branches on the algorithm in allow().",
    "Refill is computed lazily from the last time, with no timers or background threads.",
    "No floating-point drift: tokens are counted in exact units (thousandths), and retry times round up.",
    "The clock check and every other validation happen before any state changes.",
    "The sliding window drops old entries from the front of a queue, so each call is O(1) amortised.",
    "Names say what things are (capacity, perSecond, retryAfter), and the window boundary has a comment.",
  ],
  walkthrough: {
    design:
      "A token bucket needs no timers: each client stores its tokens and the time they were last computed, and every call first adds elapsed × rate tokens, capped at the capacity. Counting thousandths of a token as integers keeps refill exact, so 'exactly one second later, exactly one token' holds without rounding surprises. Both algorithms are small classes with the same four methods (tryTake, remaining, retryAfter, plus resize for buckets), so the limiter just finds or creates the right one for a client. The sliding-window log keeps allowed times in a queue and drops expired ones from the front. Its boundary rule, (t − W, t], is the detail the hidden tests check.",
    classes: [
      { name: "RateLimiter", role: "Public API: validates, keeps the clock, creates one limiter per client with its limits." },
      { name: "TokenBucket", role: "Tokens (in thousandths) and the last refill time; refills lazily on each call." },
      { name: "SlidingLog", role: "A queue of allowed request times within the window." },
    ],
    tradeoffs: [
      "Token bucket: O(1) memory per client and allows short bursts up to the capacity. A sliding-window log is exact but stores one entry per allowed request.",
      "A sliding-window counter (two fixed windows, weighted) approximates the log in O(1) memory. Mention it when memory matters.",
      "Lazy refill means an idle client costs nothing. Evict idle clients after a while, or the map grows forever.",
      "Across many servers this needs shared state (Redis with an atomic script) or per-server limits that add up. That's the HLD version, in chapter 24 of the system-design book.",
    ],
    followUps: [
      "Limits per client and per endpoint at once (a request must pass both).",
      "Return a Retry-After header and the remaining quota with every response.",
      "Make it work across 20 API servers.",
      "Evict clients that have been idle for an hour.",
    ],
  },
};
