import { randInt, type BuildProblem, type Rand, type Step } from "@/content/problem-types";

const COINS = [1, 2, 5, 10, 20];

/** A day at the office pantry: customers pay and buy, staff restock, and the odd mistake. */
function pantryDay(r: Rand, sessions: number, withExtension: boolean): Step[] {
  const slots = ["A1", "A2", "A3", "B1", "B2", "B3", "C1", "C2"];
  const items = ["Masala chips", "Lemon soda", "Peanut chikki", "Cold coffee", "Banana chips", "Jeera soda", "Rusk", "Granola bar"];
  const prices = [10, 15, 12, 25, 10, 15, 8, 30];
  const steps: Step[] = [];
  slots.forEach((s, i) => steps.push({ call: "stock", args: [s, items[i], prices[i], 40] }));
  COINS.forEach((c) => steps.push({ call: "loadCoins", args: [c, c <= 2 ? 30 : 10] }));
  for (let i = 0; i < sessions; i++) {
    const k = randInt(r, 0, slots.length - 1);
    const roll = r();
    if (roll < 0.72) {
      // a customer pays at least the price (sometimes more), then buys; any leftover is refunded
      const target = prices[k] + (r() < 0.5 ? 0 : randInt(r, 1, 12));
      let paid = 0;
      while (paid < target) {
        const c = COINS[randInt(r, 0, COINS.length - 1)];
        steps.push({ call: "insertCoin", args: [c] });
        paid += c;
      }
      steps.push({ call: "select", args: [r() < 0.03 ? "Z9" : slots[k]] });
      steps.push({ call: "refund", args: [] });
    } else if (roll < 0.8) {
      steps.push({ call: "insertCoin", args: [r() < 0.15 ? 3 : COINS[randInt(r, 0, 4)]] }); // a bad coin now and then
      steps.push({ call: "refund", args: [] });
    } else if (roll < 0.88) {
      // restock: usually the same item, sometimes a mistake
      steps.push({ call: "stock", args: [slots[k], r() < 0.1 ? "Mystery snack" : items[k], prices[k], randInt(r, 5, 15)] });
      steps.push({ call: "loadCoins", args: [COINS[randInt(r, 0, 1)], randInt(r, 5, 15)] });
    } else if (withExtension && roll < 0.93) {
      steps.push({ call: "startMaintenance", args: [] });
      steps.push({ call: "insertCoin", args: [10] }); // refused during maintenance
      steps.push({ call: "stock", args: [slots[k], items[k], prices[k], 10] });
      steps.push({ call: "endMaintenance", args: [] });
    } else if (withExtension && roll < 0.96) steps.push({ call: "sales", args: [] });
    else {
      steps.push({ call: "state", args: [] });
      steps.push({ call: "inventory", args: [slots[k]] });
    }
  }
  return steps;
}

export const vendingMachine: BuildProblem = {
  kind: "build",
  id: "vending-machine",
  chapter: "vending-machine",
  n: 1,
  title: "The office pantry vending machine",
  level: "Medium",
  shape: "Machine coding · state pattern, change-making",
  rounds: ["Machine coding"],
  minutes: 60,
  statement: `Tiffin's office has a snack vending machine that takes ₹1, ₹2, ₹5, ₹10 and ₹20 coins. Build \`VendingMachine\`: stock slots, take coins, sell, give change from the coins it actually holds, and refund.

What the machine may do depends on what state it's in, so the rules are exact about states. Hidden scenarios run a whole day of purchases against your class.

After the core passes, the interviewer adds two requirements, just as in a real round.`,
  requirements: {
    core: [
      "Stock slots with an item, a price and a count; load coins for change.",
      "Accept coins and keep a balance; reject unknown coins.",
      "Sell the item in a slot and give change, using only coins the machine holds.",
      "Refund exactly the coins inserted, and report the state.",
      "Reject invalid actions with an error and change nothing.",
    ],
    extension: ["A maintenance mode: customers can't use the machine while it's on.", "A sales report: how many of each item sold, and for how much."],
  },
  api: [
    { js: "stock(slot, item, price, count)", py: "stock(slot, item, price, count)", does: "Adds count of item to slot at price (whole rupees ≥ 1). Only while no money is inserted.", stage: "core" },
    { js: "loadCoins(value, count)", py: "load_coins(value, count)", does: "Adds coins the machine can give as change. Only while no money is inserted.", stage: "core" },
    { js: "insertCoin(value)", py: "insert_coin(value)", does: "Accepts 1, 2, 5, 10 or 20. Returns the balance.", stage: "core" },
    { js: "select(slot)", py: "select(slot)", does: "Sells the item: returns [item, change] with change as a list of coins, largest first.", stage: "core" },
    { js: "refund()", py: "refund()", does: "Returns the coins inserted since the last sale or refund, largest first ([] if none).", stage: "core" },
    { js: "state()", py: "state()", does: "\"idle\" or \"has-money\" (and \"maintenance\" in the extension).", stage: "core" },
    { js: "inventory(slot)", py: "inventory(slot)", does: "How many items are left in the slot (0 if empty or unknown).", stage: "core" },
    { js: "startMaintenance() / endMaintenance()", py: "start_maintenance() / end_maintenance()", does: "Enter or leave maintenance mode.", stage: "extension" },
    { js: "sales()", py: "sales()", does: "[[item, count, rupees], …] for every item sold, sorted by item name.", stage: "extension" },
  ],
  rules: [
    "States: idle (no money in), has-money (a balance > 0). Inserting a coin moves to has-money; a sale or a refund moves back to idle.",
    "Inserted coins are held aside until a sale. A refund gives back exactly those coins, largest first. A sale adds them to the machine's coins, then pays change from all its coins.",
    "Change is greedy: repeatedly give the largest coin the machine holds that isn't more than what's still owed. If that can't reach exactly 0, the sale fails (even if some other mix of coins would have worked), and nothing changes.",
    "A sale fails if the slot is unknown or empty, or the balance is less than the price.",
    "stock: a slot holds one item at one price. Stocking a different item or price into a slot that still has items is an error; once it's empty, anything can go in.",
    "Errors (JavaScript: throw an Error; Python: raise ValueError), changing nothing: bad coins, slots, items, prices or counts; stocking or loading coins while money is inserted; a failed sale.",
    "Maintenance (extension): only from idle. While on, state() is \"maintenance\", insertCoin, select and refund are errors, and stocking and loading coins still work. endMaintenance returns to idle; calling either at the wrong time is an error.",
    "Sales (extension): counts and rupees per item name, for completed sales only.",
  ],
  className: "VendingMachine",
  starter: {
    js: `class VendingMachine {
  constructor() {
    // your state here
  }

  stock(slot, item, price, count) {}

  loadCoins(value, count) {}

  insertCoin(value) {
    return 0;
  }

  select(slot) {
    return [null, []];
  }

  refund() {
    return [];
  }

  state() {
    return "idle";
  }

  inventory(slot) {
    return 0;
  }

  // The interviewer adds more once the core works
}
`,
    py: `class VendingMachine:
    def __init__(self):
        pass  # your state here

    def stock(self, slot, item, price, count):
        pass

    def load_coins(self, value, count):
        pass

    def insert_coin(self, value):
        return 0

    def select(self, slot):
        return [None, []]

    def refund(self):
        return []

    def state(self):
        return "idle"

    def inventory(self, slot):
        return 0

    # The interviewer adds more once the core works
`,
  },
  solution: {
    js: `// The machine's state decides which actions are allowed. Each state is a small object that
// answers "may I do this?", so adding maintenance was one new state, not ifs everywhere.
const COINS = [20, 10, 5, 2, 1]; // largest first
const SLOT = /^[A-Z][0-9]$/;

const Idle = { name: "idle", customer: true, service: true };
const HasMoney = { name: "has-money", customer: true, service: false };
const Maintenance = { name: "maintenance", customer: false, service: true };

class VendingMachine {
  constructor() {
    this.slots = new Map(); // slot → { item, price, count }
    this.coins = new Map(COINS.map((c) => [c, 0])); // coins the machine holds
    this.inserted = []; // held aside until a sale or refund
    this.mode = Idle;
    this.sold = new Map(); // item → [count, rupees]
  }

  stock(slot, item, price, count) {
    this.need(this.mode.service, "Stock only when no money is inserted");
    if (!SLOT.test(String(slot))) throw new Error("Bad slot");
    if (typeof item !== "string" || !item) throw new Error("Bad item");
    if (!whole(price, 1) || !whole(count, 1)) throw new Error("Price and count are whole numbers ≥ 1");
    const s = this.slots.get(slot);
    if (s && s.count > 0 && (s.item !== item || s.price !== price)) throw new Error("That slot holds something else");
    this.slots.set(slot, { item, price, count: (s && s.count > 0 ? s.count : 0) + count });
  }

  loadCoins(value, count) {
    this.need(this.mode.service, "Load coins only when no money is inserted");
    if (!COINS.includes(value) || !whole(count, 1)) throw new Error("Bad coins");
    this.coins.set(value, this.coins.get(value) + count);
  }

  insertCoin(value) {
    this.need(this.mode.customer, "The machine is in maintenance");
    if (!COINS.includes(value)) throw new Error("Unknown coin");
    this.inserted.push(value);
    this.mode = HasMoney;
    return this.balance();
  }

  select(slot) {
    this.need(this.mode.customer, "The machine is in maintenance");
    const s = this.slots.get(slot);
    if (!s || s.count === 0) throw new Error("Nothing in that slot");
    const owed = this.balance() - s.price;
    if (owed < 0) throw new Error("Not enough money");
    const pool = new Map(this.coins);
    for (const c of this.inserted) pool.set(c, pool.get(c) + 1);
    const change = makeChange(owed, pool);
    if (!change) throw new Error("Can't make change: please use exact money");
    // Everything checked: now commit.
    for (const c of change) pool.set(c, pool.get(c) - 1);
    this.coins = pool;
    this.inserted = [];
    s.count -= 1;
    const [n, rupees] = this.sold.get(s.item) ?? [0, 0];
    this.sold.set(s.item, [n + 1, rupees + s.price]);
    this.mode = Idle;
    return [s.item, change];
  }

  refund() {
    this.need(this.mode.customer, "The machine is in maintenance");
    const coins = [...this.inserted].sort((a, b) => b - a);
    this.inserted = [];
    this.mode = Idle;
    return coins;
  }

  state() {
    return this.mode.name;
  }

  inventory(slot) {
    return this.slots.get(slot)?.count ?? 0;
  }

  // Extension: maintenance is one more state.
  startMaintenance() {
    if (this.mode !== Idle) throw new Error("Maintenance starts only from idle");
    this.mode = Maintenance;
  }

  endMaintenance() {
    if (this.mode !== Maintenance) throw new Error("Not in maintenance");
    this.mode = Idle;
  }

  sales() {
    return [...this.sold.entries()].map(([item, [n, r]]) => [item, n, r]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  }

  balance() {
    return this.inserted.reduce((t, c) => t + c, 0);
  }

  need(ok, message) {
    if (!ok) throw new Error(message);
  }
}

const whole = (n, min) => Number.isInteger(n) && n >= min;

// Greedy change from the coins available: largest coin that fits, again and again.
function makeChange(amount, pool) {
  const out = [];
  const left = new Map(pool);
  for (const c of COINS)
    while (amount >= c && left.get(c) > 0) {
      out.push(c);
      left.set(c, left.get(c) - 1);
      amount -= c;
    }
  return amount === 0 ? out : null;
}
`,
    py: `# The machine's state decides which actions are allowed. Each state is a small object that
# answers "may I do this?", so adding maintenance was one new state, not ifs everywhere.
import re

COINS = [20, 10, 5, 2, 1]  # largest first
SLOT = re.compile(r"^[A-Z][0-9]$")


class Mode:
    def __init__(self, name, customer, service):
        self.name, self.customer, self.service = name, customer, service


IDLE = Mode("idle", True, True)
HAS_MONEY = Mode("has-money", True, False)
MAINTENANCE = Mode("maintenance", False, True)


def whole(n, least):
    return isinstance(n, int) and not isinstance(n, bool) and n >= least


def make_change(amount, pool):
    """Greedy change from the coins available: largest coin that fits, again and again."""
    out = []
    left = dict(pool)
    for c in COINS:
        while amount >= c and left[c] > 0:
            out.append(c)
            left[c] -= 1
            amount -= c
    return out if amount == 0 else None


class VendingMachine:
    def __init__(self):
        self.slots = {}  # slot -> [item, price, count]
        self.coins = {c: 0 for c in COINS}
        self.inserted = []  # held aside until a sale or refund
        self.mode = IDLE
        self.sold = {}  # item -> [count, rupees]

    def _need(self, ok, message):
        if not ok:
            raise ValueError(message)

    def stock(self, slot, item, price, count):
        self._need(self.mode.service, "Stock only when no money is inserted")
        if not isinstance(slot, str) or not SLOT.match(slot):
            raise ValueError("Bad slot")
        if not isinstance(item, str) or not item:
            raise ValueError("Bad item")
        if not whole(price, 1) or not whole(count, 1):
            raise ValueError("Price and count are whole numbers >= 1")
        s = self.slots.get(slot)
        if s and s[2] > 0 and (s[0] != item or s[1] != price):
            raise ValueError("That slot holds something else")
        self.slots[slot] = [item, price, (s[2] if s and s[2] > 0 else 0) + count]

    def load_coins(self, value, count):
        self._need(self.mode.service, "Load coins only when no money is inserted")
        if value not in COINS or isinstance(value, bool) or not whole(count, 1):
            raise ValueError("Bad coins")
        self.coins[value] += count

    def insert_coin(self, value):
        self._need(self.mode.customer, "The machine is in maintenance")
        if value not in COINS or isinstance(value, bool):
            raise ValueError("Unknown coin")
        self.inserted.append(value)
        self.mode = HAS_MONEY
        return sum(self.inserted)

    def select(self, slot):
        self._need(self.mode.customer, "The machine is in maintenance")
        s = self.slots.get(slot)
        if not s or s[2] == 0:
            raise ValueError("Nothing in that slot")
        owed = sum(self.inserted) - s[1]
        if owed < 0:
            raise ValueError("Not enough money")
        pool = dict(self.coins)
        for c in self.inserted:
            pool[c] += 1
        change = make_change(owed, pool)
        if change is None:
            raise ValueError("Can't make change: please use exact money")
        for c in change:
            pool[c] -= 1
        self.coins = pool
        self.inserted = []
        s[2] -= 1
        n, rupees = self.sold.get(s[0], [0, 0])
        self.sold[s[0]] = [n + 1, rupees + s[1]]
        self.mode = IDLE
        return [s[0], change]

    def refund(self):
        self._need(self.mode.customer, "The machine is in maintenance")
        coins = sorted(self.inserted, reverse=True)
        self.inserted = []
        self.mode = IDLE
        return coins

    def state(self):
        return self.mode.name

    def inventory(self, slot):
        s = self.slots.get(slot)
        return s[2] if s else 0

    def start_maintenance(self):
        if self.mode is not IDLE:
            raise ValueError("Maintenance starts only from idle")
        self.mode = MAINTENANCE

    def end_maintenance(self):
        if self.mode is not MAINTENANCE:
            raise ValueError("Not in maintenance")
        self.mode = IDLE

    def sales(self):
        return [[item, n, r] for item, (n, r) in sorted(self.sold.items())]
`,
  },
  scenarios: [
    {
      name: "Buy with exact money",
      stage: "core",
      visible: true,
      steps: [
        { call: "stock", args: ["A1", "Masala chips", 10, 2] },
        { call: "state", args: [], expect: "idle" },
        { call: "insertCoin", args: [5], expect: 5 },
        { call: "insertCoin", args: [5], expect: 10 },
        { call: "state", args: [], expect: "has-money" },
        { call: "select", args: ["A1"], expect: ["Masala chips", []] },
        { call: "state", args: [], expect: "idle" },
        { call: "inventory", args: ["A1"], expect: 1 },
      ],
    },
    {
      name: "Change comes from coins the machine holds",
      stage: "core",
      visible: true,
      steps: [
        { call: "stock", args: ["B2", "Lemon soda", 15, 3] },
        { call: "loadCoins", args: [2, 2] },
        { call: "loadCoins", args: [1, 1] },
        { call: "insertCoin", args: [20] },
        { call: "select", args: ["B2"], expect: ["Lemon soda", [2, 2, 1]], note: "no ₹5 in the machine, so 2 + 2 + 1" },
        { call: "insertCoin", args: [20] },
        { call: "select", args: ["B2"], throws: true, note: "₹5 owed, no ₹5s, ₹2s or ₹1s left: the sale fails" },
        { call: "state", args: [], expect: "has-money" },
        { call: "refund", args: [], expect: [20] },
        { call: "inventory", args: ["B2"], expect: 2 },
      ],
    },
    {
      name: "Inserted coins can be the change",
      stage: "core",
      visible: true,
      steps: [
        { call: "stock", args: ["C1", "Rusk", 8, 1] },
        { call: "insertCoin", args: [5] },
        { call: "insertCoin", args: [2] },
        { call: "insertCoin", args: [2] },
        { call: "select", args: ["C1"], throws: true, note: "₹1 owed and the machine has no ₹1" },
        { call: "insertCoin", args: [1], expect: 10 },
        { call: "select", args: ["C1"], expect: ["Rusk", [2]], note: "₹2 owed: one of the customer's own ₹2s" },
      ],
    },
    {
      name: "Greedy change can fail even when another mix would work",
      stage: "core",
      steps: [
        { call: "stock", args: ["A2", "Peanut chikki", 14, 1] },
        { call: "loadCoins", args: [5, 1] },
        { call: "loadCoins", args: [2, 3] },
        { call: "insertCoin", args: [20] },
        { call: "select", args: ["A2"], throws: true, note: "₹6 owed: greedy takes ₹5, then needs ₹1; 2 + 2 + 2 would have worked" },
        { call: "refund", args: [], expect: [20] },
        { call: "insertCoin", args: [10] },
        { call: "insertCoin", args: [2] },
        { call: "insertCoin", args: [2] },
        { call: "select", args: ["A2"], expect: ["Peanut chikki", []], note: "exact money always works" },
      ],
    },
    {
      name: "Refund gives back exactly what went in",
      stage: "core",
      steps: [
        { call: "refund", args: [], expect: [] },
        { call: "insertCoin", args: [2] },
        { call: "insertCoin", args: [20] },
        { call: "insertCoin", args: [5] },
        { call: "refund", args: [], expect: [20, 5, 2] },
        { call: "state", args: [], expect: "idle" },
        { call: "refund", args: [], expect: [] },
        { call: "loadCoins", args: [10, 1] },
        { call: "insertCoin", args: [5] },
        { call: "insertCoin", args: [5] },
        { call: "refund", args: [], expect: [5, 5], note: "your two ₹5s back, not the machine's ₹10" },
      ],
    },
    {
      name: "Not enough money, unknown slots and empty slots",
      stage: "core",
      steps: [
        { call: "stock", args: ["A1", "Cold coffee", 25, 1] },
        { call: "insertCoin", args: [20] },
        { call: "select", args: ["A1"], throws: true },
        { call: "select", args: ["Z9"], throws: true },
        { call: "insertCoin", args: [5] },
        { call: "select", args: ["A1"], expect: ["Cold coffee", []] },
        { call: "insertCoin", args: [20] },
        { call: "insertCoin", args: [5] },
        { call: "select", args: ["A1"], throws: true, note: "sold out" },
        { call: "inventory", args: ["A1"], expect: 0 },
        { call: "refund", args: [], expect: [20, 5] },
      ],
    },
    {
      name: "Bad input is rejected and changes nothing",
      stage: "core",
      steps: [
        { call: "insertCoin", args: [3], throws: true },
        { call: "state", args: [], expect: "idle" },
        { call: "stock", args: ["A11", "Rusk", 8, 1], throws: true },
        { call: "stock", args: ["A1", "", 8, 1], throws: true },
        { call: "stock", args: ["A1", "Rusk", 0, 1], throws: true },
        { call: "stock", args: ["A1", "Rusk", 8, 1.5], throws: true },
        { call: "loadCoins", args: [50, 1], throws: true },
        { call: "stock", args: ["A1", "Rusk", 8, 2] },
        { call: "stock", args: ["A1", "Granola bar", 30, 1], throws: true, note: "the slot still holds Rusk" },
        { call: "insertCoin", args: [10] },
        { call: "stock", args: ["A2", "Rusk", 8, 1], throws: true, note: "money is inserted" },
        { call: "loadCoins", args: [1, 5], throws: true },
        { call: "inventory", args: ["A1"], expect: 2 },
        { call: "select", args: ["A1"], throws: true, note: "₹2 change and no coins to give it" },
        { call: "refund", args: [], expect: [10] },
      ],
    },
    {
      name: "A slot can change item once it's empty",
      stage: "core",
      steps: [
        { call: "stock", args: ["B1", "Jeera soda", 15, 1] },
        { call: "insertCoin", args: [10] },
        { call: "insertCoin", args: [5] },
        { call: "select", args: ["B1"], expect: ["Jeera soda", []] },
        { call: "stock", args: ["B1", "Banana chips", 10, 4] },
        { call: "inventory", args: ["B1"], expect: 4 },
        { call: "stock", args: ["B1", "Banana chips", 10, 2] },
        { call: "inventory", args: ["B1"], expect: 6 },
      ],
    },
    {
      name: "Maintenance mode",
      stage: "extension",
      visible: true,
      steps: [
        { call: "startMaintenance", args: [] },
        { call: "state", args: [], expect: "maintenance" },
        { call: "insertCoin", args: [10], throws: true },
        { call: "stock", args: ["A1", "Rusk", 8, 5] },
        { call: "loadCoins", args: [2, 5] },
        { call: "startMaintenance", args: [], throws: true },
        { call: "endMaintenance", args: [] },
        { call: "insertCoin", args: [10] },
        { call: "select", args: ["A1"], expect: ["Rusk", [2]] },
        { call: "endMaintenance", args: [], throws: true },
      ],
    },
    {
      name: "No maintenance with money inside",
      stage: "extension",
      steps: [
        { call: "insertCoin", args: [5] },
        { call: "startMaintenance", args: [], throws: true },
        { call: "state", args: [], expect: "has-money" },
        { call: "refund", args: [], expect: [5] },
        { call: "startMaintenance", args: [] },
        { call: "refund", args: [], throws: true },
        { call: "select", args: ["A1"], throws: true },
      ],
    },
    {
      name: "A sales report",
      stage: "extension",
      visible: true,
      steps: [
        { call: "stock", args: ["A1", "Rusk", 8, 5] },
        { call: "stock", args: ["A2", "Cold coffee", 25, 5] },
        { call: "loadCoins", args: [2, 5] },
        { call: "insertCoin", args: [10] },
        { call: "select", args: ["A1"] },
        { call: "insertCoin", args: [20] },
        { call: "insertCoin", args: [5] },
        { call: "select", args: ["A2"] },
        { call: "insertCoin", args: [10] },
        { call: "select", args: ["A1"] },
        { call: "insertCoin", args: [5] },
        { call: "select", args: ["A1"], throws: true },
        { call: "refund", args: [] },
        { call: "sales", args: [], expect: [["Cold coffee", 1, 25], ["Rusk", 2, 16]] },
      ],
    },
    {
      name: "Failed sales don't count",
      stage: "extension",
      steps: [
        { call: "stock", args: ["A1", "Rusk", 8, 1] },
        { call: "insertCoin", args: [20] },
        { call: "select", args: ["A1"], throws: true },
        { call: "sales", args: [], expect: [] },
      ],
    },
  ],
  generated: [
    { name: "A day at the pantry: 700 customers and restocks", stage: "core", limitMs: 2000, gen: (r) => pantryDay(r, 700, false) },
    { name: "A day with maintenance visits and sales reports", stage: "extension", limitMs: 2000, gen: (r) => pantryDay(r, 700, true) },
  ],
  mutants: [
    { name: "Refunds pay out of the coin box instead of returning the inserted coins", from: "const coins = [...this.inserted].sort((a, b) => b - a);", to: "const coins = makeChange(this.balance(), new Map([...this.coins].map(([c, n]) => [c, n + this.inserted.filter((x) => x === c).length]))) ?? [];" },
    { name: "Change can use coins the machine doesn't have", from: "while (amount >= c && left.get(c) > 0) {", to: "while (amount >= c) {" },
    { name: "Inserted coins can't be used as change", from: "    for (const c of this.inserted) pool.set(c, pool.get(c) + 1);\n", to: "" },
    { name: "A failed sale still takes the item", from: "    const change = makeChange(owed, pool);\n    if (!change) throw new Error(\"Can't make change: please use exact money\");", to: "    s.count -= 1;\n    const change = makeChange(owed, pool);\n    if (!change) throw new Error(\"Can't make change: please use exact money\");\n    s.count += 1;" },
    { name: "Accepts a ₹3 coin", from: "if (!COINS.includes(value)) throw new Error(\"Unknown coin\");", to: "if (!COINS.includes(value) && value !== 3) throw new Error(\"Unknown coin\");" },
  ],
  hints: [
    "List the states first: no money in, money in, and later maintenance. For each action, decide which states allow it. Most bugs here are actions allowed in the wrong state.",
    "Keep inserted coins aside until a sale: a refund gives them back as they are, and a sale adds them to the coin box before making change. Make change greedily from the coins you actually hold, and if you can't reach exactly 0, refuse the sale without changing anything.",
    "One object per state with flags like customer and service makes each method's first line a single check. select: validate slot, stock and balance; build the pool (box + inserted); greedy change; only then commit everything at once.",
  ],
  review: [
    "Allowed actions come from the state (one object per state), not from if-chains in every method.",
    "Inserted coins are held aside, so a refund returns exactly what went in.",
    "A sale checks everything (slot, stock, balance, change) before changing anything.",
    "Change is computed on a copy of the coin box, so a failed attempt leaves no trace.",
    "Money is whole rupees; coins are a fixed list in one place.",
    "Names say what things are (inserted, coins, makeChange, mode).",
  ],
  walkthrough: {
    design:
      "The machine is a small state machine: idle, has-money, and (in the extension) maintenance. Instead of checking conditions in every method, each state is an object that says whether customer actions (insert, select, refund) and service actions (stock, load coins) are allowed. Inserted coins sit in an escrow list until a sale or refund, which makes refunds exact. A sale validates everything, builds a pool of the box's coins plus the inserted ones, and makes change greedily. If the greedy pass can't reach zero, the sale is refused, as real machines do with their EXACT CHANGE ONLY light.",
    classes: [
      { name: "VendingMachine", role: "Public API: checks the state, validates, and commits sales atomically." },
      { name: "Idle / HasMoney / Maintenance", role: "The states: each says which kinds of action are allowed. Maintenance was one new state." },
      { name: "makeChange", role: "Greedy change from a given pool of coins; returns null when it can't pay exactly." },
    ],
    tradeoffs: [
      "Greedy change is optimal for a canonical coin set with unlimited coins, but with limited coins it can fail where another mix works. A small dynamic program finds any valid mix, at more cost and complexity. State which rule you're implementing.",
      "State objects with flags are lighter than a class per state with every method; for richer behaviour per state (different displays, timeouts), move methods onto the states (the full state pattern).",
      "Escrow makes refunds exact but means inserted coins aren't available for change until the sale; adding them to the pool at sale time gets the best of both.",
      "Real machines also time out a session and refund automatically; that's a timer event on the has-money state.",
    ],
    followUps: [
      "Find change with any valid mix of coins (dynamic programming), not just greedy.",
      "Card payments: a payment state with approve and decline events.",
      "A session timeout that refunds automatically after two minutes.",
      "Report which slots to refill and which coins to top up.",
    ],
  },
};
