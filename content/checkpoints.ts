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

/** Equal split in whole paise: the first (amount mod n) people pay one paisa more. */
function equalSplit(paise: number, n: number) {
  return Array.from({ length: n }, (_, i) => Math.floor(paise / n) + (i < paise % n ? 1 : 0));
}

/** The parking-lot allocation rule: own size, then bigger; floors in order; lowest number. */
function allocate(floors: [string, Record<string, number>][], arrivals: string[]) {
  const sizes = ["bike", "car", "truck"];
  const slots = floors.flatMap(([f, spec]) => sizes.flatMap((sz) => Array.from({ length: spec[sz] ?? 0 }, (_, i) => ({ id: `${f}-${sz[0].toUpperCase()}${i + 1}`, size: sz, used: false }))));
  return arrivals.map((type) => {
    for (const sz of sizes.slice(sizes.indexOf(type))) {
      const s = slots.find((x) => !x.used && x.size === sz);
      if (s) return ((s.used = true), s.id);
    }
    return "Turned away";
  });
}

/** Replays cache uses and returns the evicted keys, for LRU or LFU (ties: least recently used). */
function evictions(capacity: number, uses: string[], policy: "lru" | "lfu") {
  const order: string[] = []; // least to most recent
  const count: Record<string, number> = {};
  const out: string[] = [];
  for (const k of uses) {
    if (k in count) order.splice(order.indexOf(k), 1);
    else if (order.length >= capacity) {
      const victim = policy === "lru" ? order[0] : order.reduce((best, x) => (count[x] < count[best] ? x : best), order[0]);
      order.splice(order.indexOf(victim), 1);
      delete count[victim];
      out.push(victim);
    }
    order.push(k);
    count[k] = (count[k] ?? 0) + 1;
  }
  return out;
}

/** A tiny undo-log store: ops are ["set", k, v] | ["begin"] | ["commit"] | ["rollback"]. Returns the final value of key. */
function replayTx(ops: (string | number)[][], key: string) {
  const store = new Map<string, string | number>();
  const logs: [string, string | number | undefined][][] = [];
  for (const [op, k, v] of ops) {
    if (op === "begin") logs.push([]);
    else if (op === "commit") {
      const log = logs.pop()!;
      logs[logs.length - 1]?.push(...log);
    } else if (op === "rollback") {
      const log = logs.pop()!;
      for (let i = log.length - 1; i >= 0; i--) {
        const [kk, prev] = log[i];
        if (prev === undefined) store.delete(kk);
        else store.set(kk, prev);
      }
    } else {
      logs[logs.length - 1]?.push([k as string, store.get(k as string)]);
      store.set(k as string, v);
    }
  }
  return store.has(key) ? String(store.get(key)) : "Nothing (the key is gone)";
}

/** Greedy change from a limited coin box: largest coin that fits, repeatedly. Returns null if it can't pay exactly. */
function greedyChange(amount: number, box: Record<number, number>) {
  const out: number[] = [];
  for (const c of [20, 10, 5, 2, 1])
    for (let n = box[c] ?? 0; n > 0 && amount >= c; n--) {
      out.push(c);
      amount -= c;
    }
  return amount === 0 ? out : null;
}

/** A buy against resting sells listed in arrival order: [price, qty] fills, best price first, then earliest. */
function buyAgainst(sells: [number, number][], qty: number, limit: number | null) {
  const book = sells.map(([price, q], seq) => ({ price, q, seq })).sort((a, b) => a.price - b.price || a.seq - b.seq);
  const fills: [number, number][] = [];
  for (const o of book) {
    if (qty === 0 || (limit !== null && o.price > limit)) break;
    const take = Math.min(qty, o.q);
    fills.push([o.price, take]);
    qty -= take;
  }
  return fills;
}

/** One lift, SCAN: the order it reaches its stops from a floor and direction. */
function scanOrder(floor: number, dir: "up" | "down", stops: number[]) {
  const left = new Set(stops);
  const order: number[] = [];
  while (left.size) {
    const ahead = [...left].filter((s) => (dir === "up" ? s > floor : s < floor));
    if (!ahead.length) {
      dir = dir === "up" ? "down" : "up";
      continue;
    }
    floor += dir === "up" ? 1 : -1;
    if (left.delete(floor)) order.push(floor);
  }
  return order;
}

const approx = (x: number) => {
  const p = 10 ** (Math.floor(Math.log10(x)) - 1);
  return `About ${(Math.round(x / p) * p).toLocaleString("en-US")}`;
};

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
  "mc-time": {
    id: "mc-time",
    prompt: "A 90-minute round. You spend 10 minutes clarifying, 10 modelling, and keep the last 15 for testing and the demo. How many minutes are left to build the core and the extension?",
    options: ["45", "55", "65", "75"],
    compute: () => String(90 - 10 - 10 - 15),
    explain: "90 − 10 − 10 − 15 = 55 minutes of building. That's why the core has to be small and the happy path comes first: you need time left when the interviewer adds a requirement.",
  },
  "mc-extend": {
    id: "mc-extend",
    prompt: "Your parking lot charges by the hour. Forty minutes in, the interviewer says weekend rates are different. Which design absorbs that best?",
    options: [
      "Add an if (isWeekend) branch inside ParkingLot.exit()",
      "A PricingStrategy interface, with HourlyPricing and WeekendPricing classes",
      "Copy ParkingLot into a WeekendParkingLot subclass",
      "Store a weekend flag on every Ticket",
    ],
    answer: 1,
    explain: "Pricing is the part that changes, so it goes behind an interface. A new rule is then a new class, and ParkingLot doesn't change. The if-branch works once, but the third rule turns it into a tangle; the subclass duplicates everything else.",
  },
  "split-equal": {
    id: "split-equal",
    prompt: "₹100.00 is 10,000 paise. Split equally between 3 friends, with the leftover paise going to the first friends in order, what does each pay?",
    options: ["3334, 3333, 3333", "3333, 3333, 3333", "3333, 3333, 3334", "3334, 3334, 3332"],
    compute: () => equalSplit(10_000, 3).join(", "),
    explain: "10,000 ÷ 3 is 3,333 with 1 paisa left over, and that paisa goes to the first friend. Every paisa is accounted for: 3,334 + 3,333 + 3,333 = 10,000.",
  },
  "split-net": {
    id: "split-net",
    prompt: "Asha pays ₹600 for a meal split equally between Asha, Bilal and Chen. Then Bilal pays ₹300 for cabs, split equally between the same three. After netting, what's between Asha and Bilal?",
    options: ["Bilal owes Asha ₹200", "Asha owes Bilal ₹100", "Bilal owes Asha ₹100", "They're even"],
    compute: () => {
      const bilalOwesAsha = 600 / 3 - 300 / 3;
      return bilalOwesAsha === 0 ? "They're even" : bilalOwesAsha > 0 ? `Bilal owes Asha ₹${bilalOwesAsha}` : `Asha owes Bilal ₹${-bilalOwesAsha}`;
    },
    explain: "Bilal owes Asha ₹200 for the meal, and Asha owes Bilal ₹100 for the cabs. Netted, that's one number: Bilal owes Asha ₹100.",
  },
  "hld-qps": {
    id: "hld-qps",
    prompt: "50 million people use the app each day and each opens 10 feeds a day. Roughly how many feed reads per second is that, on average?",
    options: ["About 600", "About 5,800", "About 58,000", "About 500,000"],
    compute: () => approx((50_000_000 * 10) / 86_400),
    explain: "500 million reads ÷ 86,400 seconds ≈ 5,800 a second. In your head: 5 × 10⁸ ÷ 10⁵ = 5,000, which is close enough to design with. Then multiply by the peak factor.",
  },
  "hld-storage": {
    id: "hld-storage",
    prompt: "1 million new posts a day, about 1 KB each, kept for 5 years. Roughly how much storage, before replication?",
    options: ["About 180 GB", "About 1.8 TB", "About 18 TB", "About 180 TB"],
    compute: () => {
      const gb = (1_000_000 * 1000 * 365 * 5) / 1e9;
      return gb >= 1000 ? `About ${(Math.round(gb / 100) / 10).toString()} TB` : `About ${Math.round(gb)} GB`;
    },
    explain: "10⁶ × 1 KB = 1 GB a day; × 365 × 5 ≈ 1,825 GB, so about 1.8 TB. Three copies make it about 5.5 TB: still small enough for a handful of machines.",
  },
  "url-codes": {
    id: "url-codes",
    prompt: "Short codes use 0–9, a–z and A–Z. How many different 6-character codes are there?",
    options: ["About 2.2 million", "About 57 billion", "About 3.5 trillion", "About 56 million"],
    compute: () => `About ${Math.round(62 ** 6 / 1e9)} billion`,
    explain: "62⁶ ≈ 5.7 × 10¹⁰, about 57 billion. That's enough for 6 billion links, but only 10× over; 7 characters (3.5 trillion) leaves room for decades of growth.",
  },
  "url-cache": {
    id: "url-cache",
    prompt: "20,000 redirects a second, and the cache answers 90% of them. How many reads a second reach the database?",
    options: ["200", "2,000", "18,000", "20,000"],
    compute: () => Math.round(20_000 * (1 - 0.9)).toLocaleString("en-US"),
    explain: "Only misses reach the database: 10% of 20,000 is 2,000. Raise the hit rate to 99% and it's 200, which is why caching hot keys is the first move for read-heavy systems.",
  },
  "pl-slot": {
    id: "pl-slot",
    prompt: "Floor G has 1 bike slot and 1 car slot; floor L1 (added second) has 2 car slots. A bike arrives, then another bike, then a car. Where does the car go?",
    options: ["G-C1", "L1-C1", "L1-C2", "Turned away"],
    compute: () => allocate([["G", { bike: 1, car: 1 }], ["L1", { car: 2 }]], ["bike", "bike", "car"])[2],
    explain: "The first bike takes G-B1. The second bike finds no bike slot, so it takes the next size up: G-C1. The car's own size comes first, and G's car slot is now taken, so it goes to the next floor: L1-C1.",
  },
  "pl-fee": {
    id: "pl-fee",
    prompt: "A car parks at 10:10 and leaves at 12:20. Cars pay ₹50 per started hour. What's the fee?",
    options: ["₹100", "₹110", "₹150", "₹200"],
    compute: () => `₹${Math.max(1, Math.ceil((12 * 60 + 20 - (10 * 60 + 10)) / 60)) * 50}`,
    explain: "130 minutes is 2 hours and 10 minutes, so 3 started hours: 3 × ₹50 = ₹150. Charging per minute would give about ₹108, which is why the rule has to be written down before you code.",
  },
  "cache-lru": {
    id: "cache-lru",
    prompt: "An LRU cache holds 3 menus. Menus are used in this order: A, B, C, A, D, B, E. Which menus get dropped, in order?",
    options: ["A, B, C", "B, C, A", "B, A, C", "C, A, B"],
    compute: () => evictions(3, ["A", "B", "C", "A", "D", "B", "E"], "lru").join(", "),
    explain: "After A is used again, the order from oldest to newest is B, C, A. D arrives: B goes. B comes back: now C is oldest, so C goes. E arrives: the order is A, D, B, so A goes, even though it was used twice. LRU only remembers when, not how often.",
  },
  "cache-lfu": {
    id: "cache-lfu",
    prompt: "Same uses, A, B, C, A, D, B, E, but the cache is LFU (ties go to the least recently used). Which menus get dropped, in order?",
    options: ["B, C, A", "C, D, B", "B, C, D", "B, D, C"],
    compute: () => evictions(3, ["A", "B", "C", "A", "D", "B", "E"], "lfu").join(", "),
    explain: "A has 2 uses after its second use, so LFU protects it. D arrives: B and C have 1 use each, B is older, so B goes. B comes back: C and D have 1 use, C is older, so C goes. E arrives: D and B have 1 use, D is older, so D goes. A is never dropped.",
  },
  "rl-tokens": {
    id: "rl-tokens",
    prompt: "A token bucket holds 5 tokens and refills at 2 tokens a second. A client sends 5 requests at once, then waits 1.2 seconds. How many more requests can it make right away?",
    options: ["1", "2", "3", "5"],
    compute: () => String(Math.floor(Math.min(5, 0 + 1.2 * 2))),
    explain: "The burst empties the bucket. 1.2 s × 2 tokens/s = 2.4 tokens, and a request needs a whole token, so 2 requests. The 0.4 isn't lost: it's still there towards the next one.",
  },
  "rl-window": {
    id: "rl-window",
    prompt: "A sliding window allows 3 requests in any 10 seconds. Requests were allowed at 0 s, 4 s and 9 s. Is a request at exactly 10 s allowed?",
    options: ["Yes", "No"],
    compute: () => ([0, 4, 9].filter((t) => t > 10 - 10).length < 3 ? "Yes" : "No"),
    explain: "The window is (0 s, 10 s]: the request at 0 s is exactly 10 seconds old, so it no longer counts. That leaves 4 s and 9 s, two of three, so the request is allowed. Boundary rules like this are what hidden tests check.",
  },
  "kv-rollback": {
    id: "kv-rollback",
    prompt: "set price = 100. begin. set price = 120. begin. set price = 150. commit. rollback. What is price now?",
    options: ["150", "120", "100", "Nothing (the key is gone)"],
    compute: () => replayTx([["set", "price", 100], ["begin"], ["set", "price", 120], ["begin"], ["set", "price", 150], ["commit"], ["rollback"]], "price"),
    explain: "The inner commit hands its change to the outer transaction instead of making it permanent. The outer rollback then undoes both the 150 and the 120, back to the value before the outer begin: 100.",
  },
  "kv-expiry": {
    id: "kv-expiry",
    prompt: "At t = 0, set otp = 4821 with a TTL of 300 ms. Nobody reads it. At t = 300 you count how many keys hold 4821. What should the count be?",
    options: ["0", "1"],
    compute: () => {
      const setAt = 0;
      const ttl = 300;
      const now = 300;
      return now < setAt + ttl ? "1" : "0"; // live while now < set time + TTL
    },
    explain: "The key is live while t < 0 + 300, so at t = 300 it's gone, even though nothing read it. That's why expiry needs its own structure (a min-heap of expiry times) instead of only checking on reads.",
  },
  "cache-stampede": {
    id: "cache-stampede",
    prompt: "A hot menu gets 20,000 requests a second. Its cache entry expires, and refilling it from the database takes 200 ms. With plain cache-aside, roughly how many requests go to the database before the entry is back?",
    options: ["1", "200", "About 4,000", "About 20,000"],
    compute: () => `About ${(20_000 * 0.2).toLocaleString("en-US")}`,
    explain: "Every request that misses during the 200 ms refill goes to the database itself: 20,000 × 0.2 s = 4,000 identical queries for one key. With request coalescing, the first miss fetches and the other 3,999 wait for its result: 1 query.",
  },
  "cache-average": {
    id: "cache-average",
    prompt: "A cache answers in 1 ms and has a 95% hit rate. A miss checks the cache (1 ms), then the database (20 ms). What's the average read time?",
    options: ["About 1 ms", "About 2 ms", "About 5 ms", "About 20 ms"],
    compute: () => `About ${Math.round(0.95 * 1 + 0.05 * (1 + 20))} ms`,
    explain: "0.95 × 1 ms + 0.05 × 21 ms = 1.95 ms, about 2. The misses dominate: at 99% hits it's about 1.2 ms. That's why raising the hit rate a few points matters more than shaving the cache's own latency.",
  },
  "cache-jitter": {
    id: "cache-jitter",
    prompt: "10,000 menus are cached at the same moment with a 5-minute TTL. If each TTL gets a random ±10% jitter, the expiries spread over 60 seconds. About how many expire per second, instead of all 10,000 at once?",
    options: ["About 17", "About 170", "About 1,700", "10,000"],
    compute: () => `About ${Math.round(10_000 / (300 * 0.2) / 10) * 10}`,
    explain: "±10% of 300 s is a 60-second spread, so 10,000 ÷ 60 ≈ 167 a second. The database sees a gentle stream of refills instead of 10,000 at the same moment.",
  },
  "drl-local": {
    id: "drl-local",
    prompt: "A partner's limit is 100 calls a minute. You run 8 gateways, each counting on its own and allowing 100 a minute, with calls spread round robin. The partner sends 1,000 calls in a minute. How many get through?",
    options: ["100", "125", "800", "1,000"],
    compute: () => Math.min(1000, 8 * 100).toLocaleString("en-US"),
    explain: "Each gateway sees about 125 of the partner's calls and lets 100 of them through: 8 × 100 = 800, eight times the limit. Local counts only work if each partner always lands on the same gateway, or if the counts are shared.",
  },
  "drl-nodes": {
    id: "drl-nodes",
    prompt: "Every one of 30,000 calls a second runs one counter update on Redis. One Redis node handles about 100,000 operations a second. How many nodes do you need to stay under 70% even after one fails?",
    options: ["1", "2", "3", "5"],
    compute: () => {
      const work = 30_000 / 100_000; // the load as a fraction of one node
      // the smallest count that still leaves at least one node, under 70%, after one fails
      for (let n = 2; ; n++) if (work / (n - 1) <= 0.7) return String(n);
    },
    explain: "One node would be 30% busy, but if it fails there's nothing left. With two, losing one leaves a single node at 30%. Memory isn't the issue either: 50,000 partners × ~100 bytes is about 5 MB.",
  },
  "ns-backlog": {
    id: "ns-backlog",
    prompt: "At 20,000 notifications a second, the push provider goes down for 5 minutes. With a queue in front of it, how many messages pile up?",
    options: ["About 100,000", "About 1.2 million", "About 6 million", "About 60 million"],
    compute: () => `About ${(20_000 * 5 * 60) / 1_000_000} million`,
    explain: "20,000 × 300 seconds = 6 million. The queue must hold them durably, and when the provider returns, workers drain the backlog on top of new traffic. Spare capacity decides how long that takes.",
  },
  "ns-drain": {
    id: "ns-drain",
    prompt: "After that outage, workers can send 30,000 a second in total, while 20,000 a second keep arriving. How long until the 6 million backlog is gone?",
    options: ["About 3 minutes", "About 10 minutes", "About 5 minutes", "About 20 minutes"],
    compute: () => `About ${Math.round(6_000_000 / (30_000 - 20_000) / 60)} minutes`,
    explain: "Only the spare 10,000 a second goes to the backlog: 6,000,000 ÷ 10,000 = 600 s, 10 minutes. Headroom isn't waste: it's how fast you recover. Priorities help too, so an OTP doesn't wait behind 6 million order updates.",
  },
  "feed-pull": {
    id: "feed-pull",
    prompt: "With fan-out on read, every feed load reads the latest posts of everyone you follow. At 50,000 loads a second and 300 accounts followed, how many timeline reads is that per second?",
    options: ["About 150,000", "About 1.5 million", "About 15 million", "About 150 million"],
    compute: () => `About ${(50_000 * 300) / 1e6} million`,
    explain: "50,000 × 300 = 15 million reads a second, every second, just to assemble feeds. That's why big feeds precompute (fan out on write) for most authors.",
  },
  "feed-memory": {
    id: "feed-memory",
    prompt: "40 million users keep the newest 200 entries in their feeds. How much memory do the feeds take if each entry is an 8-byte post id?",
    options: ["About 6.4 GB", "About 64 GB", "About 640 GB", "About 6.4 TB"],
    compute: () => `About ${(40_000_000 * 200 * 8) / 1e9} GB`,
    explain: "40 M × 200 × 8 bytes = 64 GB: one big cache node, or spread across a few. Copying whole posts (~1 KB) instead would be 8 TB. Store ids, and fetch the posts for a page in one batched read.",
  },
  "vm-change": {
    id: "vm-change",
    prompt: "The machine owes ₹6 in change and holds one ₹5 coin and three ₹2 coins (no ₹1s). Using greedy change (largest coin that fits, repeatedly), what happens?",
    options: ["It gives 5 + 1", "It gives 2 + 2 + 2", "The sale is refused", "It gives 5 and keeps ₹1"],
    compute: () => {
      const c = greedyChange(6, { 5: 1, 2: 3 });
      return c ? `It gives ${c.join(" + ")}` : "The sale is refused";
    },
    explain: "Greedy takes the ₹5 first, then owes ₹1 and has no ₹1 coin, so it fails, even though 2 + 2 + 2 would have worked. Real machines handle this by refusing the sale (the EXACT CHANGE ONLY light); a small dynamic program could find the other mix.",
  },
  "vm-state": {
    id: "vm-state",
    prompt: "A customer has inserted ₹10 and walked away. Which of these should the machine allow right now?",
    options: ["Restocking a slot", "Loading change coins", "Starting maintenance", "A refund"],
    answer: 3,
    explain: "With money inside, the machine is in the has-money state: only customer actions (more coins, select, refund) make sense. Restocking or maintenance now would mix the customer's money with the service visit. Each state should answer this question in one place.",
  },
  "mb-race": {
    id: "mb-race",
    prompt: "Asha holds D5 and D6. A moment later, Bilal asks to hold D6 and D7 together. What does Bilal get?",
    options: ["D6 and D7", "Only D7", "Nothing: his hold is refused", "D7 now, and D6 when Asha's hold ends"],
    compute: () => {
      const held = new Set(["D5", "D6"]);
      const want = ["D6", "D7"];
      return want.every((x) => !held.has(x)) ? "D6 and D7" : "Nothing: his hold is refused"; // all or nothing
    },
    explain: "Holds are all or nothing. D6 is Asha's, so Bilal's request fails as a whole: holding D7 alone would block it for everyone and isn't what he asked for.",
  },
  "mb-expiry": {
    id: "mb-expiry",
    prompt: "Asha's hold started at 20:00:00 and lasts 10 minutes. Her payment arrives at exactly 20:10:00. Is it confirmed?",
    options: ["Yes", "No"],
    compute: () => {
      const start = 20 * 3600;
      const paid = 20 * 3600 + 600;
      return paid < start + 600 ? "Yes" : "No"; // live while time < start + 10 minutes
    },
    explain: "A hold is live while time < start + 10 minutes, so at exactly 20:10:00 it has ended and the seats may already be someone else's. The payment is refused (and refunded). Boundaries like this one are exactly what hidden tests check.",
  },
  "el-scan": {
    id: "el-scan",
    prompt: "A lift is on floor 5 going up. Its stops are floors 2, 7 and 9. In what order does it reach them, using SCAN?",
    options: ["2, 7, 9", "7, 2, 9", "7, 9, 2", "9, 7, 2"],
    compute: () => scanOrder(5, "up", [2, 7, 9]).join(", "),
    explain: "SCAN keeps going in its direction while there are stops ahead: up to 7, then 9. With nothing above, it turns and goes down to 2. Going to the nearest stop first (7, then 2, then 9) would zigzag and could leave someone waiting at the top for a long time.",
  },
  "el-cost": {
    id: "el-cost",
    prompt: "Someone on floor 6 presses Down. Car 1 is on floor 2 going up to 10. Car 2 is idle on floor 12. Using the cost rule (distance if idle or already coming that way, otherwise the trip out and back), which car answers?",
    options: ["Car 1", "Car 2"],
    compute: () => {
      const car1 = Math.abs(10 - 2) + Math.abs(10 - 6); // going up, not coming down: up to 10 and back
      const car2 = Math.abs(12 - 6); // idle
      return car1 < car2 ? "Car 1" : "Car 2";
    },
    explain: "Car 1 is heading up, away from a Down call, so it would go to 10 and come back: 8 + 4 = 12 floors. Idle car 2 is 6 floors away, so it answers. Being close isn't enough; the direction matters.",
  },
  "ob-match": {
    id: "ob-match",
    prompt: "Resting sells, in the order they arrived: 101 × 5, then 100 × 3, then 100 × 4. A buy for 6 at 101 arrives. What trades happen?",
    options: ["5 at 101, then 1 at 100", "3 at 100, then 3 at 100", "4 at 100, then 2 at 100", "6 at 101"],
    compute: () => buyAgainst([[101, 5], [100, 3], [100, 4]], 6, 101).map(([p, q]) => `${q} at ${p}`).join(", then "),
    explain: "Price comes first: 100 beats 101 for a buyer, although the 101 order arrived first. Between the two orders at 100, time decides: the 3 kilos that arrived earlier trade first, then 3 of the later 4. The 101 order isn't touched.",
  },
  "ob-sweep": {
    id: "ob-sweep",
    prompt: "Resting sells: 102 × 4, 103 × 6 and 110 × 20. A market buy for 10 arrives. What's the average price it pays per kilo?",
    options: ["102", "102.6", "103", "110"],
    compute: () => {
      const fills = buyAgainst([[102, 4], [103, 6], [110, 20]], 10, null);
      return String(fills.reduce((t, [p, q]) => t + p * q, 0) / fills.reduce((t, [, q]) => t + q, 0));
    },
    explain: "A market order walks the book from the best price: 4 at 102, then 6 at 103. That's 408 + 618 = 1,026 for 10 kilos, 102.6 each. A bigger order would reach 110, which is why large orders are split up or sent with a limit.",
  },
  "tb-admit": {
    id: "tb-admit",
    prompt: "The seat database takes 3,000 writes a second. Each admitted fan writes one hold, and 4 in 5 also write a booking when they pay. To keep the database at most 60% busy, how many fans can the waiting room admit per second?",
    options: ["600", "1,000", "1,667", "3,000"],
    compute: () => Math.floor((3000 * 0.6) / (1 + 0.8)).toLocaleString("en-US"),
    explain: "Each admitted fan costs 1 + 0.8 = 1.8 writes on average. 60% of 3,000 is 1,800 writes a second, so 1,800 ÷ 1.8 = 1,000 fans a second. Admission is a dial set from what the slowest exact component can take.",
  },
  "tb-wait": {
    id: "tb-wait",
    prompt: "You're number 24,000 in line, and the room admits 1,000 fans a second. Roughly how long do you wait?",
    options: ["24 seconds", "4 minutes", "40 minutes", "4 hours"],
    compute: () => {
      const s = 24_000 / 1000;
      return s < 60 ? `${s} seconds` : `${s / 60} minutes`;
    },
    explain: "24,000 ÷ 1,000 = 24 seconds. Showing that estimate is half the value of a waiting room: people who know they're 24 seconds away don't refresh. Number 240,000 would wait 4 minutes for nothing: the passes run out after about the first 50,000 fans, so a good waiting room tells everyone past that point early.",
  },
  "tb-gateways": {
    id: "tb-gateways",
    prompt: "The line gets 90,000 joins and place checks a second. Each gateway handles 8,000 a second, and you want every gateway at most 70% busy. How many gateways do you need?",
    options: ["12", "15", "17", "23"],
    compute: () => String(Math.ceil(90_000 / (8000 * 0.7))),
    explain: "70% of 8,000 is 5,600 a second per gateway; 90,000 ÷ 5,600 = 16.1, so 17. With one down, 16 run at about 70%, still under capacity.",
  },
};

export function correctIndex(c: Checkpoint): number {
  if (c.compute) return c.options.indexOf(c.compute());
  return c.answer ?? -1;
}
