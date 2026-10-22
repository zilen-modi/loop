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
};

export function correctIndex(c: Checkpoint): number {
  if (c.compute) return c.options.indexOf(c.compute());
  return c.answer ?? -1;
}
