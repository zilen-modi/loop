import { randInt, type BuildProblem, type Rand, type Step } from "@/content/problem-types";

/** A busy trading session: limit orders around a drifting price, some market orders, cancels and queries. */
function session(r: Rand, calls: number, withExtension: boolean): Step[] {
  const steps: Step[] = [];
  let mid = 1000;
  let id = 0;
  const live: string[] = [];
  for (let t = 0; t < calls; t++) {
    mid = Math.max(900, Math.min(1100, mid + randInt(r, -2, 2)));
    const roll = r();
    const side = r() < 0.5 ? "buy" : "sell";
    if (roll < 0.6) {
      const price = side === "buy" ? mid - randInt(r, -2, 8) : mid + randInt(r, -2, 8);
      const oid = `O${++id}`;
      steps.push({ call: "limit", args: [oid, side, price, randInt(r, 1, 50), t] });
      live.push(oid);
    } else if (roll < 0.68) {
      steps.push({ call: "market", args: [`O${++id}`, side, randInt(r, 1, 80), t] });
    } else if (roll < 0.78 && live.length) {
      steps.push({ call: "cancel", args: [live.splice(randInt(r, 0, live.length - 1), 1)[0]] });
    } else if (withExtension && roll < 0.84 && live.length) {
      steps.push({ call: "modify", args: [live[randInt(r, 0, live.length - 1)], randInt(r, 1, 60), t] });
    } else if (withExtension && roll < 0.9) {
      const price = side === "buy" ? mid - randInt(r, 0, 5) : mid + randInt(r, 0, 5);
      const oid = `O${++id}`;
      steps.push({ call: "iceberg", args: [oid, side, price, randInt(r, 40, 200), randInt(r, 5, 20), t] });
      live.push(oid);
    } else if (roll < 0.94) {
      steps.push({ call: "depth", args: [side, 3] });
    } else if (roll < 0.98) {
      steps.push({ call: r() < 0.5 ? "bestBid" : "bestAsk", args: [] });
    } else {
      steps.push({ call: "limit", args: [`O${id}`, side, mid, 5, t] }); // a repeated id: refused
    }
  }
  return steps;
}

/** A deep book built before the open, then a stream of small market orders, cancels and depth checks. */
function openingBell(r: Rand, resting: number, takers: number): Step[] {
  const steps: Step[] = [];
  let t = 0;
  for (let i = 1; i <= resting; i++) {
    const side = i % 2 ? "buy" : "sell";
    const price = side === "buy" ? randInt(r, 500, 999) : randInt(r, 1001, 1500);
    steps.push({ call: "limit", args: [`R${i}`, side, price, randInt(r, 1, 20), t] });
    if (i % 100 === 0) t++;
  }
  for (let i = 1; i <= takers; i++) {
    t++;
    const roll = r();
    if (roll < 0.8) steps.push({ call: "market", args: [`T${i}`, r() < 0.5 ? "buy" : "sell", randInt(r, 1, 10), t] });
    else if (roll < 0.9) steps.push({ call: "cancel", args: [`R${randInt(r, 1, resting)}`] });
    else steps.push({ call: "depth", args: [r() < 0.5 ? "buy" : "sell", 5] });
  }
  return steps;
}

export const orderBook: BuildProblem = {
  kind: "build",
  id: "order-book",
  chapter: "order-book",
  n: 1,
  title: "A matching engine for cardamom contracts",
  level: "Hard",
  shape: "Machine coding · price-time priority",
  rounds: ["Machine coding"],
  minutes: 90,
  statement: `Tiffin buys a lot of cardamom, and its procurement team now trades monthly cardamom contracts with growers on a small exchange. Build the exchange's heart, \`OrderBook\`: buyers and sellers post orders, and the engine matches them by **price, then time**.

Prices are whole paise per kilo and quantities are whole kilos, so every trade is exact. Each call carries a time, which only goes forward.

After the core passes, the interviewer adds two requirements, just as in a real round.`,
  requirements: {
    core: [
      "Accept limit orders: buy up to a price, or sell down to a price. Whatever doesn't match rests in the book.",
      "Match by price, then time: the best price first, and at the same price, the order that arrived first.",
      "Accept market orders: trade at whatever prices the book offers. Whatever's left is cancelled.",
      "Cancel resting orders, and report the best prices and the depth of the book.",
      "Reject invalid input with an error and change nothing.",
    ],
    extension: ["Modify a resting order's quantity: shrinking keeps its place in the queue, growing loses it.", "Iceberg orders: show only part of a big order, and show the next part when that one trades."],
  },
  api: [
    { js: "limit(id, side, price, qty, time)", py: "limit(id, side, price, qty, time)", does: "side is \"buy\" or \"sell\". Returns the trades, [[buyId, sellId, price, qty], …], in the order they happened.", stage: "core" },
    { js: "market(id, side, qty, time)", py: "market(id, side, qty, time)", does: "Trades against the book until filled or the book runs out; never rests. Returns the trades.", stage: "core" },
    { js: "cancel(id)", py: "cancel(id)", does: "true if a resting order was removed; false if it's unknown, filled or already cancelled.", stage: "core" },
    { js: "bestBid() / bestAsk()", py: "best_bid() / best_ask()", does: "The highest resting buy price / lowest resting sell price, or null (None).", stage: "core" },
    { js: "depth(side, levels)", py: "depth(side, levels)", does: "[[price, total qty], …] for the best `levels` prices on that side, best first.", stage: "core" },
    { js: "modify(id, qty, time)", py: "modify(id, qty, time)", does: "Sets a resting order's remaining quantity. Returns true, or false if it isn't resting.", stage: "extension" },
    { js: "iceberg(id, side, price, total, peak, time)", py: "iceberg(id, side, price, total, peak, time)", does: "A limit order that shows only `peak` at a time. Returns the trades.", stage: "extension" },
  ],
  rules: [
    "A buy matches resting sells priced at or below its price, lowest first; a sell matches resting buys at or above its price, highest first. At the same price, the order that arrived first goes first.",
    "Every trade happens at the resting order's price, for the smaller of the two remaining quantities. Matching continues until the incoming order is filled or nothing else crosses.",
    "Order ids are unique for the whole session (whether the order rested, filled, was cancelled or was a market order). Prices and quantities are whole numbers, at least 1. Times are whole and never go backwards; equal times are fine.",
    "Errors (JavaScript: throw an Error; Python: raise ValueError), changing nothing: a repeated or empty id, a side that isn't \"buy\" or \"sell\", a bad price, quantity, number of levels or time.",
    "depth totals the remaining quantity of every resting order at each price (for icebergs, only the part that's shown).",
    "Modify (extension): a quantity at or below the current one keeps the order's place (an iceberg loses hidden quantity first); a larger one moves it to the back of its price's queue, as if it arrived now. Below 1 is an error.",
    "Iceberg (extension): an incoming iceberg trades its whole size against the book first; what's left rests showing min(peak, left). When the shown part is used up and more is hidden, the next min(peak, hidden) is shown at the back of its price's queue, and matching continues.",
  ],
  className: "OrderBook",
  starter: {
    js: `class OrderBook {
  constructor() {
    // your state here
  }

  limit(id, side, price, qty, time) {
    return [];
  }

  market(id, side, qty, time) {
    return [];
  }

  cancel(id) {
    return false;
  }

  bestBid() {
    return null;
  }

  bestAsk() {
    return null;
  }

  depth(side, levels) {
    return [];
  }

  // The interviewer adds more once the core works
}
`,
    py: `class OrderBook:
    def __init__(self):
        pass  # your state here

    def limit(self, id, side, price, qty, time):
        return []

    def market(self, id, side, qty, time):
        return []

    def cancel(self, id):
        return False

    def best_bid(self):
        return None

    def best_ask(self):
        return None

    def depth(self, side, levels):
        return []

    # The interviewer adds more once the core works
`,
  },
  solution: {
    js: `// Each side of the book maps a price to a queue of orders, oldest first, and keeps a sorted list
// of the prices present, best first. Matching walks the other side's best prices in order.
class Side {
  constructor(isBuy) {
    this.isBuy = isBuy;
    this.levels = new Map(); // price → orders at that price, oldest first
    this.prices = []; // best first
  }

  add(order) {
    let q = this.levels.get(order.price);
    if (!q) {
      q = [];
      this.levels.set(order.price, q);
      let lo = 0;
      let hi = this.prices.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (this.isBuy ? this.prices[mid] > order.price : this.prices[mid] < order.price) lo = mid + 1;
        else hi = mid;
      }
      this.prices.splice(lo, 0, order.price);
    }
    q.push(order);
  }

  remove(order) {
    const q = this.levels.get(order.price);
    q.splice(q.indexOf(order), 1);
    if (!q.length) {
      this.levels.delete(order.price);
      this.prices.splice(this.prices.indexOf(order.price), 1);
    }
  }

  best() {
    return this.prices.length ? this.prices[0] : null;
  }
}

class OrderBook {
  constructor() {
    this.buys = new Side(true);
    this.sells = new Side(false);
    this.orders = new Map(); // id → resting order
    this.used = new Set(); // every id ever accepted
    this.now = 0;
  }

  limit(id, side, price, qty, time) {
    if (!whole(price, 1)) throw new Error("Bad price");
    this.check(id, side, qty, time);
    return this.place({ id, side, price, shown: qty, hidden: 0, peak: Infinity });
  }

  market(id, side, qty, time) {
    this.check(id, side, qty, time);
    const trades = [];
    this.match({ id, side, shown: qty }, null, trades);
    return trades;
  }

  cancel(id) {
    const o = this.orders.get(id);
    if (!o) return false;
    this.book(o.side).remove(o);
    this.orders.delete(id);
    return true;
  }

  bestBid() {
    return this.buys.best();
  }

  bestAsk() {
    return this.sells.best();
  }

  depth(side, levels) {
    if (side !== "buy" && side !== "sell") throw new Error("Side is buy or sell");
    if (!whole(levels, 1)) throw new Error("Bad number of levels");
    const s = this.book(side);
    return s.prices.slice(0, levels).map((p) => [p, s.levels.get(p).reduce((t, o) => t + o.shown, 0)]);
  }

  // Extension
  modify(id, qty, time) {
    if (!whole(qty, 1)) throw new Error("Quantity must be at least 1");
    this.tick(time);
    const o = this.orders.get(id);
    if (!o) return false;
    const total = o.shown + o.hidden;
    if (qty <= total) {
      // Shrinking keeps the order's place; an iceberg gives up hidden quantity first.
      const cut = total - qty;
      const fromHidden = Math.min(cut, o.hidden);
      o.hidden -= fromHidden;
      o.shown -= cut - fromHidden;
    } else {
      // Growing goes to the back of the queue, as if the order arrived now.
      const s = this.book(o.side);
      s.remove(o);
      o.shown = Math.min(o.peak, qty);
      o.hidden = qty - o.shown;
      s.add(o);
    }
    return true;
  }

  iceberg(id, side, price, total, peak, time) {
    if (!whole(price, 1) || !whole(peak, 1)) throw new Error("Bad price or peak");
    this.check(id, side, total, time);
    return this.place({ id, side, price, shown: total, hidden: 0, peak });
  }

  // ——— helpers
  // Match an incoming limit or iceberg order, then rest what's left, showing at most its peak.
  place(order) {
    const trades = [];
    this.match(order, order.price, trades);
    if (order.shown > 0) {
      const left = order.shown;
      order.shown = Math.min(order.peak, left);
      order.hidden = left - order.shown;
      this.book(order.side).add(order);
      this.orders.set(order.id, order);
    }
    return trades;
  }

  // Trade the incoming order against the other side while prices cross (limit null: any price).
  match(incoming, limit, trades) {
    const other = incoming.side === "buy" ? this.sells : this.buys;
    while (incoming.shown > 0 && other.prices.length) {
      const price = other.prices[0];
      if (limit !== null && (incoming.side === "buy" ? price > limit : price < limit)) break;
      const resting = other.levels.get(price)[0];
      const qty = Math.min(incoming.shown, resting.shown);
      trades.push(incoming.side === "buy" ? [incoming.id, resting.id, price, qty] : [resting.id, incoming.id, price, qty]);
      incoming.shown -= qty;
      resting.shown -= qty;
      if (resting.shown === 0) this.refill(resting);
    }
  }

  // A resting order whose shown part is used up shows its next part at the back of the queue, or leaves the book.
  refill(order) {
    const s = this.book(order.side);
    s.remove(order);
    order.shown = Math.min(order.peak, order.hidden);
    order.hidden -= order.shown;
    if (order.shown > 0) s.add(order);
    else this.orders.delete(order.id);
  }

  book(side) {
    return side === "buy" ? this.buys : this.sells;
  }

  check(id, side, qty, time) {
    if (typeof id !== "string" || !id || this.used.has(id)) throw new Error("Order ids are new, non-empty strings");
    if (side !== "buy" && side !== "sell") throw new Error("Side is buy or sell");
    if (!whole(qty, 1)) throw new Error("Bad quantity");
    this.tick(time);
    this.used.add(id);
  }

  tick(time) {
    if (!whole(time, 0) || time < this.now) throw new Error("Time must be whole and never go backwards");
    this.now = time;
  }
}

const whole = (n, min) => Number.isInteger(n) && n >= min;
`,
    py: `# Each side of the book maps a price to a queue of orders, oldest first, and keeps a sorted list
# of the prices present. Matching walks the other side's best prices in order.
from bisect import insort
from collections import deque

INF = float("inf")


def whole(n, least):
    return isinstance(n, int) and not isinstance(n, bool) and n >= least


class Order:
    def __init__(self, id, side, price, shown, peak):
        self.id = id
        self.side = side
        self.price = price
        self.shown = shown
        self.hidden = 0
        self.peak = peak


class Side:
    def __init__(self, is_buy):
        self.is_buy = is_buy
        self.levels = {}  # price → deque of orders, oldest first
        self.prices = []  # ascending

    def add(self, order):
        q = self.levels.get(order.price)
        if q is None:
            q = self.levels[order.price] = deque()
            insort(self.prices, order.price)
        q.append(order)

    def remove(self, order):
        q = self.levels[order.price]
        q.remove(order)
        if not q:
            del self.levels[order.price]
            self.prices.remove(order.price)

    def best(self):
        if not self.prices:
            return None
        return self.prices[-1] if self.is_buy else self.prices[0]

    def best_first(self, n):
        return self.prices[::-1][:n] if self.is_buy else self.prices[:n]


class OrderBook:
    def __init__(self):
        self.buys = Side(True)
        self.sells = Side(False)
        self.orders = {}  # id → resting order
        self.used = set()  # every id ever accepted
        self.now = 0

    def limit(self, id, side, price, qty, time):
        if not whole(price, 1):
            raise ValueError("Bad price")
        self._check(id, side, qty, time)
        return self._place(Order(id, side, price, qty, INF))

    def market(self, id, side, qty, time):
        self._check(id, side, qty, time)
        trades = []
        self._match(Order(id, side, None, qty, INF), None, trades)
        return trades

    def cancel(self, id):
        o = self.orders.pop(id, None)
        if o is None:
            return False
        self._book(o.side).remove(o)
        return True

    def best_bid(self):
        return self.buys.best()

    def best_ask(self):
        return self.sells.best()

    def depth(self, side, levels):
        if side not in ("buy", "sell"):
            raise ValueError("Side is buy or sell")
        if not whole(levels, 1):
            raise ValueError("Bad number of levels")
        s = self._book(side)
        return [[p, sum(o.shown for o in s.levels[p])] for p in s.best_first(levels)]

    # Extension
    def modify(self, id, qty, time):
        if not whole(qty, 1):
            raise ValueError("Quantity must be at least 1")
        self._tick(time)
        o = self.orders.get(id)
        if o is None:
            return False
        total = o.shown + o.hidden
        if qty <= total:
            # Shrinking keeps the order's place; an iceberg gives up hidden quantity first.
            cut = total - qty
            from_hidden = min(cut, o.hidden)
            o.hidden -= from_hidden
            o.shown -= cut - from_hidden
        else:
            # Growing goes to the back of the queue, as if the order arrived now.
            s = self._book(o.side)
            s.remove(o)
            o.shown = min(o.peak, qty)
            o.hidden = qty - o.shown
            s.add(o)
        return True

    def iceberg(self, id, side, price, total, peak, time):
        if not whole(price, 1) or not whole(peak, 1):
            raise ValueError("Bad price or peak")
        self._check(id, side, total, time)
        return self._place(Order(id, side, price, total, peak))

    # ——— helpers
    def _place(self, order):
        trades = []
        self._match(order, order.price, trades)
        if order.shown > 0:
            left = order.shown
            order.shown = min(order.peak, left)
            order.hidden = left - order.shown
            self._book(order.side).add(order)
            self.orders[order.id] = order
        return trades

    def _match(self, incoming, limit, trades):
        other = self.sells if incoming.side == "buy" else self.buys
        while incoming.shown > 0 and other.prices:
            price = other.best()
            if limit is not None and (price > limit if incoming.side == "buy" else price < limit):
                break
            resting = other.levels[price][0]
            qty = min(incoming.shown, resting.shown)
            if incoming.side == "buy":
                trades.append([incoming.id, resting.id, price, qty])
            else:
                trades.append([resting.id, incoming.id, price, qty])
            incoming.shown -= qty
            resting.shown -= qty
            if resting.shown == 0:
                self._refill(resting)

    def _refill(self, order):
        s = self._book(order.side)
        s.remove(order)
        order.shown = min(order.peak, order.hidden)
        order.hidden -= order.shown
        if order.shown > 0:
            s.add(order)
        else:
            del self.orders[order.id]

    def _book(self, side):
        return self.buys if side == "buy" else self.sells

    def _check(self, id, side, qty, time):
        if not isinstance(id, str) or not id or id in self.used:
            raise ValueError("Order ids are new, non-empty strings")
        if side not in ("buy", "sell"):
            raise ValueError("Side is buy or sell")
        if not whole(qty, 1):
            raise ValueError("Bad quantity")
        self._tick(time)
        self.used.add(id)

    def _tick(self, time):
        if not whole(time, 0) or time < self.now:
            raise ValueError("Time must be whole and never go backwards")
        self.now = time
`,
  },
  scenarios: [
    {
      name: "Orders rest, then cross",
      stage: "core",
      visible: true,
      steps: [
        { call: "limit", args: ["B1", "buy", 100, 10, 1], expect: [] },
        { call: "limit", args: ["S1", "sell", 105, 5, 2], expect: [] },
        { call: "bestBid", args: [], expect: 100 },
        { call: "bestAsk", args: [], expect: 105 },
        { call: "limit", args: ["S2", "sell", 100, 4, 3], expect: [["B1", "S2", 100, 4]], note: "a sell at 100 meets the buy at 100" },
        { call: "depth", args: ["buy", 3], expect: [[100, 6]] },
        { call: "limit", args: ["B2", "buy", 106, 8, 4], expect: [["B2", "S1", 105, 5]], note: "3 kilos are left over and rest at 106" },
        { call: "bestBid", args: [], expect: 106 },
        { call: "bestAsk", args: [], expect: null },
      ],
    },
    {
      name: "Price first, then time",
      stage: "core",
      visible: true,
      steps: [
        { call: "limit", args: ["S1", "sell", 102, 5, 1] },
        { call: "limit", args: ["S2", "sell", 101, 5, 2] },
        { call: "limit", args: ["S3", "sell", 101, 5, 3] },
        { call: "limit", args: ["S4", "sell", 103, 5, 4] },
        { call: "limit", args: ["B1", "buy", 103, 12, 5], expect: [["B1", "S2", 101, 5], ["B1", "S3", 101, 5], ["B1", "S1", 102, 2]], note: "101 before 102 although S1 came first; S2 before S3 at the same price" },
        { call: "depth", args: ["sell", 3], expect: [[102, 3], [103, 5]] },
      ],
    },
    {
      name: "Trades happen at the resting order's price",
      stage: "core",
      visible: true,
      steps: [
        { call: "limit", args: ["B1", "buy", 110, 5, 1] },
        { call: "limit", args: ["S1", "sell", 100, 3, 2], expect: [["B1", "S1", 110, 3]], note: "the seller asked for 100 and gets the 110 already on offer" },
        { call: "limit", args: ["S2", "sell", 120, 2, 3], expect: [] },
        { call: "limit", args: ["B2", "buy", 125, 2, 4], expect: [["B2", "S2", 120, 2]] },
      ],
    },
    {
      name: "Market orders take what's there and never rest",
      stage: "core",
      steps: [
        { call: "limit", args: ["S1", "sell", 100, 3, 1] },
        { call: "limit", args: ["S2", "sell", 104, 3, 2] },
        { call: "market", args: ["M1", "buy", 10, 3], expect: [["M1", "S1", 100, 3], ["M1", "S2", 104, 3]] },
        { call: "bestAsk", args: [], expect: null },
        { call: "bestBid", args: [], expect: null, note: "the 4 kilos left are cancelled, not rested" },
        { call: "market", args: ["M2", "sell", 5, 4], expect: [] },
        { call: "cancel", args: ["M1"], expect: false },
        { call: "limit", args: ["M1", "buy", 99, 1, 5], throws: true, note: "a market order's id is used up too" },
      ],
    },
    {
      name: "Cancelling",
      stage: "core",
      steps: [
        { call: "limit", args: ["B1", "buy", 100, 5, 1] },
        { call: "limit", args: ["B2", "buy", 100, 7, 2] },
        { call: "limit", args: ["B3", "buy", 99, 4, 3] },
        { call: "cancel", args: ["B1"], expect: true },
        { call: "cancel", args: ["B1"], expect: false },
        { call: "cancel", args: ["NOPE"], expect: false },
        { call: "depth", args: ["buy", 5], expect: [[100, 7], [99, 4]] },
        { call: "market", args: ["S9", "sell", 8, 4], expect: [["B2", "S9", 100, 7], ["B3", "S9", 99, 1]] },
        { call: "cancel", args: ["B2"], expect: false, note: "filled orders can't be cancelled" },
        { call: "cancel", args: ["B3"], expect: true },
        { call: "bestBid", args: [], expect: null },
      ],
    },
    {
      name: "Depth adds up each price, best first",
      stage: "core",
      steps: [
        { call: "limit", args: ["B1", "buy", 100, 5, 1] },
        { call: "limit", args: ["B2", "buy", 101, 2, 1] },
        { call: "limit", args: ["B3", "buy", 100, 3, 1] },
        { call: "limit", args: ["B4", "buy", 98, 1, 2] },
        { call: "limit", args: ["S1", "sell", 103, 4, 2] },
        { call: "limit", args: ["S2", "sell", 102, 6, 2] },
        { call: "limit", args: ["S3", "sell", 103, 1, 3] },
        { call: "depth", args: ["buy", 2], expect: [[101, 2], [100, 8]] },
        { call: "depth", args: ["buy", 10], expect: [[101, 2], [100, 8], [98, 1]] },
        { call: "depth", args: ["sell", 5], expect: [[102, 6], [103, 5]] },
        { call: "depth", args: ["both", 2], throws: true },
        { call: "depth", args: ["buy", 0], throws: true },
      ],
    },
    {
      name: "Bad input changes nothing",
      stage: "core",
      steps: [
        { call: "limit", args: ["B1", "buy", 100, 5, 5] },
        { call: "limit", args: ["B2", "hold", 100, 5, 6], throws: true },
        { call: "limit", args: ["B2", "sell", 0, 5, 6], throws: true },
        { call: "limit", args: ["B2", "sell", 100.5, 5, 6], throws: true },
        { call: "limit", args: ["B2", "sell", 100, 0, 6], throws: true },
        { call: "limit", args: ["B2", "sell", 100, 2.5, 6], throws: true },
        { call: "limit", args: ["B2", "sell", 100, 5, 4], throws: true, note: "time went backwards" },
        { call: "limit", args: ["B1", "sell", 100, 5, 6], throws: true, note: "B1 is taken" },
        { call: "limit", args: ["", "sell", 100, 5, 6], throws: true },
        { call: "market", args: ["M1", "sell", -3, 6], throws: true },
        { call: "depth", args: ["buy", 1], expect: [[100, 5]] },
        { call: "limit", args: ["B2", "sell", 100, 5, 5], expect: [["B1", "B2", 100, 5]], note: "B2 wasn't used up, and the clock is still at 5" },
      ],
    },
    {
      name: "A partly filled order keeps its place",
      stage: "core",
      steps: [
        { call: "limit", args: ["S1", "sell", 100, 10, 1] },
        { call: "limit", args: ["S2", "sell", 100, 10, 2] },
        { call: "limit", args: ["B1", "buy", 100, 4, 3], expect: [["B1", "S1", 100, 4]] },
        { call: "limit", args: ["B2", "buy", 100, 8, 4], expect: [["B2", "S1", 100, 6], ["B2", "S2", 100, 2]] },
        { call: "depth", args: ["sell", 1], expect: [[100, 8]] },
      ],
    },
    {
      name: "Sweep several prices, then rest the rest",
      stage: "core",
      steps: [
        { call: "limit", args: ["S1", "sell", 101, 2, 1] },
        { call: "limit", args: ["S2", "sell", 102, 2, 1] },
        { call: "limit", args: ["S3", "sell", 103, 2, 1] },
        { call: "limit", args: ["S4", "sell", 105, 2, 1] },
        { call: "limit", args: ["B1", "buy", 103, 10, 2], expect: [["B1", "S1", 101, 2], ["B1", "S2", 102, 2], ["B1", "S3", 103, 2]] },
        { call: "bestBid", args: [], expect: 103 },
        { call: "bestAsk", args: [], expect: 105 },
        { call: "depth", args: ["buy", 1], expect: [[103, 4]] },
        { call: "market", args: ["S5", "sell", 1, 3], expect: [["B1", "S5", 103, 1]] },
      ],
    },
    {
      name: "Shrinking keeps your place, growing loses it",
      stage: "extension",
      steps: [
        { call: "limit", args: ["B1", "buy", 100, 5, 1] },
        { call: "limit", args: ["B2", "buy", 100, 5, 2] },
        { call: "limit", args: ["B3", "buy", 100, 5, 3] },
        { call: "modify", args: ["B1", 3, 4], expect: true },
        { call: "modify", args: ["B2", 9, 5], expect: true, note: "B2 goes behind B3" },
        { call: "depth", args: ["buy", 1], expect: [[100, 17]] },
        { call: "market", args: ["S1", "sell", 10, 6], expect: [["B1", "S1", 100, 3], ["B3", "S1", 100, 5], ["B2", "S1", 100, 2]] },
        { call: "depth", args: ["buy", 1], expect: [[100, 7]] },
      ],
    },
    {
      name: "Modifying filled, unknown and same-size orders",
      stage: "extension",
      steps: [
        { call: "limit", args: ["B1", "buy", 100, 5, 1] },
        { call: "market", args: ["S1", "sell", 5, 2], expect: [["B1", "S1", 100, 5]] },
        { call: "modify", args: ["B1", 3, 3], expect: false },
        { call: "modify", args: ["ZZ", 3, 3], expect: false },
        { call: "modify", args: ["B1", 0, 3], throws: true },
        { call: "limit", args: ["B2", "buy", 100, 5, 3] },
        { call: "limit", args: ["B3", "buy", 100, 1, 3] },
        { call: "modify", args: ["B2", 5, 2], throws: true, note: "time went backwards" },
        { call: "modify", args: ["B2", 5, 3], expect: true, note: "the same size keeps its place" },
        { call: "market", args: ["S2", "sell", 1, 4], expect: [["B2", "S2", 100, 1]] },
      ],
    },
    {
      name: "An iceberg shows only its peak",
      stage: "extension",
      steps: [
        { call: "iceberg", args: ["I1", "sell", 100, 50, 10, 1], expect: [] },
        { call: "limit", args: ["S2", "sell", 100, 5, 2] },
        { call: "depth", args: ["sell", 1], expect: [[100, 15]], note: "40 kilos are hidden" },
        { call: "market", args: ["B1", "buy", 12, 3], expect: [["B1", "I1", 100, 10], ["B1", "S2", 100, 2]], note: "I1's next 10 go behind S2" },
        { call: "depth", args: ["sell", 1], expect: [[100, 13]] },
        { call: "market", args: ["B2", "buy", 20, 4], expect: [["B2", "S2", 100, 3], ["B2", "I1", 100, 10], ["B2", "I1", 100, 7]] },
        { call: "depth", args: ["sell", 1], expect: [[100, 3]], note: "3 shown, 20 hidden" },
        { call: "cancel", args: ["I1"], expect: true },
        { call: "bestAsk", args: [], expect: null },
      ],
    },
    {
      name: "An incoming iceberg trades its whole size first",
      stage: "extension",
      steps: [
        { call: "limit", args: ["S1", "sell", 100, 30, 1] },
        { call: "iceberg", args: ["I1", "buy", 101, 50, 5, 2], expect: [["I1", "S1", 100, 30]] },
        { call: "depth", args: ["buy", 1], expect: [[101, 5]], note: "20 left: 5 shown, 15 hidden" },
        { call: "iceberg", args: ["I2", "buy", 101, 0, 5, 2], throws: true },
        { call: "iceberg", args: ["I2", "buy", 101, 10, 0, 2], throws: true },
        { call: "modify", args: ["I1", 12, 3], expect: true, note: "the 8 kilos come off the hidden part" },
        { call: "depth", args: ["buy", 1], expect: [[101, 5]] },
        { call: "market", args: ["S2", "sell", 12, 4], expect: [["I1", "S2", 101, 5], ["I1", "S2", 101, 5], ["I1", "S2", 101, 2]] },
        { call: "bestBid", args: [], expect: null },
      ],
    },
  ],
  generated: [
    { name: "A trading session: 3,000 orders, cancels and queries", stage: "core", limitMs: 1000, gen: (r) => session(r, 3000, false) },
    { name: "Opening bell: 20,000 resting orders, then 20,000 market orders and cancels", stage: "core", limitMs: 500, gen: (r) => openingBell(r, 20_000, 20_000) },
    { name: "A session with modifies and icebergs", stage: "extension", limitMs: 1000, gen: (r) => session(r, 3000, true) },
  ],
  mutants: [
    { name: "Trades at the incoming order's price", from: "[incoming.id, resting.id, price, qty] : [resting.id, incoming.id, price, qty]", to: "[incoming.id, resting.id, limit ?? price, qty] : [resting.id, incoming.id, limit ?? price, qty]" },
    { name: "Newest order first at the same price", from: "    q.push(order);", to: "    q.unshift(order);" },
    { name: "Doesn't trade at exactly the limit price", from: "price > limit : price < limit", to: "price >= limit : price <= limit" },
    { name: "A bad price uses up the order id", from: "    if (!whole(price, 1)) throw new Error(\"Bad price\");\n    this.check(id, side, qty, time);", to: "    this.check(id, side, qty, time);\n    if (!whole(price, 1)) throw new Error(\"Bad price\");" },
    { name: "Growing an order keeps its place", from: "    if (qty <= total) {", to: "    if (qty <= total || o.peak === Infinity) {" },
    { name: "An iceberg's next part keeps its place", from: "    s.remove(order);\n    order.shown = Math.min(order.peak, order.hidden);\n    order.hidden -= order.shown;\n    if (order.shown > 0) s.add(order);\n    else this.orders.delete(order.id);", to: "    order.shown = Math.min(order.peak, order.hidden);\n    order.hidden -= order.shown;\n    if (order.shown === 0) {\n      s.remove(order);\n      this.orders.delete(order.id);\n    }" },
    { name: "Depth counts hidden quantity", from: "t + o.shown, 0)", to: "t + o.shown + o.hidden, 0)" },
  ],
  slowVariant: {
    name: "Every resting order in one list, scanned for the best on every trade",
    js: `class OrderBook {
  constructor() { this.resting = []; this.used = new Set(); this.now = 0; this.seq = 0; }
  limit(id, side, price, qty, time) {
    if (!Number.isInteger(price) || price < 1) throw new Error("Bad price");
    this.check(id, side, qty, time);
    const o = { id, side, price, qty, seq: this.seq++ };
    const trades = this.match(o, price);
    if (o.qty > 0) this.resting.push(o);
    return trades;
  }
  market(id, side, qty, time) {
    this.check(id, side, qty, time);
    return this.match({ id, side, qty }, null);
  }
  cancel(id) {
    const i = this.resting.findIndex((o) => o.id === id);
    if (i < 0) return false;
    this.resting.splice(i, 1);
    return true;
  }
  best(side) {
    let b = null;
    for (const o of this.resting) {
      if (o.side !== side) continue;
      if (b === null || (side === "buy" ? o.price > b.price : o.price < b.price) || (o.price === b.price && o.seq < b.seq)) b = o;
    }
    return b;
  }
  bestBid() { const b = this.best("buy"); return b ? b.price : null; }
  bestAsk() { const b = this.best("sell"); return b ? b.price : null; }
  depth(side, levels) {
    if (side !== "buy" && side !== "sell") throw new Error("bad side");
    if (!Number.isInteger(levels) || levels < 1) throw new Error("bad levels");
    const m = new Map();
    for (const o of this.resting) if (o.side === side) m.set(o.price, (m.get(o.price) ?? 0) + o.qty);
    return [...m].sort((a, b) => (side === "buy" ? b[0] - a[0] : a[0] - b[0])).slice(0, levels);
  }
  match(o, limit) {
    const trades = [];
    const other = o.side === "buy" ? "sell" : "buy";
    while (o.qty > 0) {
      const r = this.best(other);
      if (!r || (limit !== null && (o.side === "buy" ? r.price > limit : r.price < limit))) break;
      const q = Math.min(o.qty, r.qty);
      trades.push(o.side === "buy" ? [o.id, r.id, r.price, q] : [r.id, o.id, r.price, q]);
      o.qty -= q;
      r.qty -= q;
      if (r.qty === 0) this.resting.splice(this.resting.indexOf(r), 1);
    }
    return trades;
  }
  check(id, side, qty, time) {
    if (typeof id !== "string" || !id || this.used.has(id)) throw new Error("bad id");
    if (side !== "buy" && side !== "sell") throw new Error("bad side");
    if (!Number.isInteger(qty) || qty < 1) throw new Error("bad qty");
    if (!Number.isInteger(time) || time < this.now) throw new Error("bad time");
    this.now = time;
    this.used.add(id);
  }
}
`,
  },
  hints: [
    "Two questions decide everything: what's the best price on each side, and who's first at that price? Pick a structure that answers both without scanning every order.",
    "Per side, keep a map from price to a queue of orders (oldest first), plus the prices present in sorted order, best first. A map from id to resting order makes cancel quick.",
    "Matching: while the incoming order has quantity left and the other side's best price crosses, trade with the front order at that price, at the resting price, for the smaller quantity; remove it when it's done. Validate everything (price too) before you record the id or move the clock.",
  ],
  review: [
    "Best price and first-in-line are each found without scanning the whole book.",
    "Trades are at the resting order's price, and the matching loop stops as soon as prices stop crossing.",
    "Every input is checked before anything changes: the id isn't used up and the clock doesn't move on an error.",
    "Market orders share the matching code with limit orders and just never rest.",
    "Empty price levels are removed, so the best price is always a real order.",
    "Names say what things are (levels, prices, resting, shown, hidden).",
  ],
  walkthrough: {
    design:
      "The book has two sides. Each side maps a price to a queue of resting orders, oldest first, and keeps the prices present in a sorted list, best first (highest for buys, lowest for sells). That makes both priority questions cheap: the best price is the head of the list, and the first order at that price is the head of its queue. An incoming order is matched against the other side in a loop: while it has quantity left and the best opposite price crosses its limit, trade with the front order at the resting price, for the smaller quantity. A resting order that's used up leaves its queue, and an empty queue leaves the price list. What's left of a limit order rests; what's left of a market order is dropped. A map from id to resting order makes cancel and modify direct.",
    classes: [
      { name: "OrderBook", role: "Validates calls, matches incoming orders, rests what's left, answers queries." },
      { name: "Side", role: "One side of the book: price → queue of orders, and the sorted list of prices, best first." },
      { name: "order", role: "id, side, price, the shown quantity, and for icebergs the hidden quantity and peak." },
    ],
    tradeoffs: [
      "A sorted array of prices costs O(levels) to insert a new price, but the best price is O(1). A balanced tree or heap makes insertion O(log n); real engines often use an array indexed by price ticks, since prices sit in a narrow band.",
      "Queues as arrays make removing from the middle O(n); a linked list (or a deque in Python) with a pointer from each order makes cancel O(1).",
      "Matching in one thread, in arrival order, is what makes the result deterministic. Real exchanges run one matching thread per instrument for the same reason, and scale by instrument.",
      "Icebergs and modifies are where priority rules get subtle; write them down as rules before coding them.",
    ],
    followUps: [
      "Stop orders: become market orders once the last trade price crosses a trigger.",
      "Time-in-force: immediate-or-cancel and fill-or-kill orders.",
      "Self-trade prevention: a trader's buy shouldn't match their own sell.",
      "Many instruments, and publishing the book's changes to subscribers as a market-data feed.",
    ],
  },
};
