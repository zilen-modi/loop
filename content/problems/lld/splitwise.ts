import { randInt, type BuildProblem, type Rand, type Step } from "@/content/problem-types";

const users = (n: number) => Array.from({ length: n }, (_, i) => `U${String(i).padStart(2, "0")}`);

function pick<T>(r: Rand, list: T[], k: number): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, k);
}

/** A long, realistic session: many bills of every kind, some invalid calls, some settlements. */
function busyGroup(r: Rand, people: number, bills: number, withExtension: boolean): Step[] {
  const ids = users(people);
  const steps: Step[] = ids.map((id) => ({ call: "addUser", args: [id, `Friend ${id}`] }));
  const types = withExtension ? ["equal", "exact", "percent", "shares"] : ["equal", "exact", "percent"];
  for (let b = 0; b < bills; b++) {
    if (r() < 0.12) {
      const [from, to] = pick(r, ids, 2);
      steps.push({ call: "settle", args: [from, to, randInt(r, 1, 3000)] }); // sometimes more than owed: must throw
      continue;
    }
    const payer = ids[randInt(r, 0, people - 1)];
    const group = pick(r, ids, randInt(r, 1, 6));
    const amount = randInt(r, 1, 50_000);
    const type = types[randInt(r, 0, types.length - 1)];
    if (type === "equal") steps.push({ call: "addExpense", args: [payer, amount, "equal", group] });
    else if (type === "exact") {
      const cuts = group.map(() => randInt(r, 0, amount));
      const total = cuts.reduce((a, c) => a + c, 0) || 1;
      const values = cuts.map((c) => Math.floor((c * amount) / total));
      values[0] += amount - values.reduce((a, v) => a + v, 0);
      if (r() < 0.1) values[0] += 1; // an invalid bill now and then
      steps.push({ call: "addExpense", args: [payer, amount, "exact", group, values] });
    } else if (type === "percent") {
      const values = group.map(() => 0);
      for (let p = 0; p < 100; p++) values[randInt(r, 0, group.length - 1)]++;
      steps.push({ call: "addExpense", args: [payer, amount, "percent", group, values] });
    } else {
      steps.push({ call: "addExpense", args: [payer, amount, "shares", group, group.map(() => randInt(r, 1, 5))] });
    }
  }
  steps.push({ call: "balances", args: [] });
  ids.forEach((id) => steps.push({ call: "balanceOf", args: [id] }));
  if (withExtension) steps.push({ call: "simplify", args: [] });
  return steps;
}

const add3 = (): Step[] => [
  { call: "addUser", args: ["A", "Asha"] },
  { call: "addUser", args: ["B", "Bilal"] },
  { call: "addUser", args: ["C", "Chen"] },
];

export const splitwise: BuildProblem = {
  kind: "build",
  id: "splitwise",
  chapter: "splitwise",
  n: 1,
  title: "Splitwise in 90 minutes",
  level: "Medium",
  shape: "Machine coding · strategy pattern",
  rounds: ["Machine coding"],
  minutes: 90,
  statement: `Build the core of an expense-sharing app as one class, \`ExpenseManager\`. Friends add bills, choose how each bill is split, see who owes whom, and settle up.

All money is in **paise** (whole numbers, ₹1 = 100 paise), so there's no floating-point rounding. Follow the rules exactly: hidden tests check every number.

After the core passes, the interviewer adds two requirements, just as in a real round.`,
  requirements: {
    core: [
      "Add users with a unique id.",
      "Add an expense paid by one user and split equally, by exact amounts, or by percentages.",
      "Show every outstanding debt, netted between each pair.",
      "Show any user's overall balance.",
      "Record a settlement payment.",
      "Reject invalid input with an error and leave everything unchanged.",
    ],
    extension: ["A new split type: by shares (for example 2 : 1 : 1).", "Suggest a short list of payments that settles everyone (simplify debts)."],
  },
  api: [
    { js: "addUser(id, name)", py: "add_user(id, name)", does: "Adds a user. Duplicate or empty ids are errors.", stage: "core" },
    { js: "addExpense(paidBy, amount, type, participants, values?)", py: "add_expense(paid_by, amount, type, participants, values=None)", does: "type is \"equal\", \"exact\" or \"percent\". values are needed for exact and percent.", stage: "core" },
    { js: "balances()", py: "balances()", does: "Every pair with a debt, as [debtor, creditor, amount], sorted by debtor then creditor.", stage: "core" },
    { js: "balanceOf(id)", py: "balance_of(id)", does: "What others owe this user minus what this user owes others.", stage: "core" },
    { js: "settle(from, to, amount)", py: "settle(from_, to, amount)", does: "from pays to. Can't exceed what from currently owes to.", stage: "core" },
    { js: "addExpense(…, \"shares\", participants, values)", py: "add_expense(…, \"shares\", participants, values)", does: "New split type: values are positive whole-number shares.", stage: "extension" },
    { js: "simplify()", py: "simplify()", does: "A list of [from, to, amount] payments that settles everyone. Doesn't change any balances.", stage: "extension" },
  ],
  rules: [
    "Amounts are whole numbers of paise, at least 1.",
    "Participants: at least one, no repeats, all existing users. The payer must exist and may or may not be a participant.",
    "Equal: everyone gets floor(amount ÷ n); the first (amount mod n) participants, in the order given, get 1 paisa more.",
    "Exact: one value per participant, each a whole number ≥ 0, adding up to the amount.",
    "Percent: one whole-number percentage ≥ 0 per participant, adding up to 100. Each share is floor(amount × p ÷ 100); any paise left over go one each to participants in the order given, starting with the first.",
    "Shares (extension): one whole number ≥ 1 per participant. Each share is floor(amount × s ÷ total shares); leftovers as for percent.",
    "Every participant other than the payer owes the payer their share. Debts between two people net out: if A owes B 300 and B owes A 100, then A owes B 200.",
    "Any invalid call throws (JavaScript: an Error; Python: a ValueError) and changes nothing.",
    "Simplify (extension): repeatedly take the user with the most negative balance and the user with the most positive balance (ties go to the smaller id), pay the smaller of the two amounts, and record it. Stop when everyone is at zero.",
  ],
  className: "ExpenseManager",
  starter: {
    js: `class ExpenseManager {
  constructor() {
    // your state here
  }

  addUser(id, name) {}

  addExpense(paidBy, amount, type, participants, values) {}

  balances() {
    return [];
  }

  balanceOf(id) {
    return 0;
  }

  settle(from, to, amount) {}

  // The interviewer adds more once the core works
}
`,
    py: `class ExpenseManager:
    def __init__(self):
        pass  # your state here

    def add_user(self, id, name):
        pass

    def add_expense(self, paid_by, amount, type, participants, values=None):
        pass

    def balances(self):
        return []

    def balance_of(self, id):
        return 0

    def settle(self, from_, to, amount):
        pass

    # The interviewer adds more once the core works
`,
  },
  solution: {
    js: `// Each split rule turns (amount, participants, values) into one share per participant.
// Adding a split type means adding a class here, not editing ExpenseManager.
class EqualSplit {
  shares(amount, participants) {
    const n = participants.length;
    const base = Math.floor(amount / n);
    return participants.map((_, i) => base + (i < amount % n ? 1 : 0));
  }
}

class ExactSplit {
  shares(amount, participants, values) {
    checkValues(participants, values, 0);
    if (sum(values) !== amount) throw new Error("Exact amounts must add up to the total");
    return [...values];
  }
}

class ProportionalSplit {
  // total = 100 for percentages; null means "the sum of the shares".
  constructor(total, min) {
    this.total = total;
    this.min = min;
  }
  shares(amount, participants, values) {
    checkValues(participants, values, this.min);
    if (this.total !== null && sum(values) !== this.total) throw new Error("Percentages must add up to " + this.total);
    const total = this.total ?? sum(values);
    const out = values.map((v) => Math.floor((amount * v) / total));
    for (let i = 0, left = amount - sum(out); left > 0; i++, left--) out[i] += 1;
    return out;
  }
}

const sum = (xs) => xs.reduce((a, b) => a + b, 0);

function checkValues(participants, values, min) {
  if (!Array.isArray(values) || values.length !== participants.length) throw new Error("Give one value per participant");
  if (values.some((v) => !Number.isInteger(v) || v < min)) throw new Error("Values must be whole numbers ≥ " + min);
}

class ExpenseManager {
  constructor() {
    this.users = new Map();
    this.net = new Map(); // "a|b" with a < b: how much a owes b (negative: b owes a)
    this.splits = {
      equal: new EqualSplit(),
      exact: new ExactSplit(),
      percent: new ProportionalSplit(100, 0),
      shares: new ProportionalSplit(null, 1),
    };
  }

  addUser(id, name) {
    if (typeof id !== "string" || !id || id.includes("|")) throw new Error("Invalid user id");
    if (this.users.has(id)) throw new Error("User " + id + " already exists");
    this.users.set(id, name);
  }

  addExpense(paidBy, amount, type, participants, values) {
    this.requireUser(paidBy);
    requireAmount(amount);
    if (!Array.isArray(participants) || participants.length === 0) throw new Error("Add at least one participant");
    if (new Set(participants).size !== participants.length) throw new Error("Participants must be unique");
    participants.forEach((u) => this.requireUser(u));
    const rule = this.splits[type];
    if (!rule) throw new Error("Unknown split type " + type);
    const shares = rule.shares(amount, participants, values); // validates before anything changes
    participants.forEach((u, i) => this.owe(u, paidBy, shares[i]));
  }

  settle(from, to, amount) {
    this.requireUser(from);
    this.requireUser(to);
    requireAmount(amount);
    if (amount > this.owed(from, to)) throw new Error("Can't settle more than is owed");
    this.owe(to, from, amount);
  }

  balances() {
    const out = [];
    for (const [key, v] of this.net) {
      if (v === 0) continue;
      const [a, b] = key.split("|");
      out.push(v > 0 ? [a, b, v] : [b, a, -v]);
    }
    return out.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0));
  }

  balanceOf(id) {
    this.requireUser(id);
    let total = 0;
    for (const [key, v] of this.net) {
      const [a, b] = key.split("|");
      if (a === id) total -= v;
      else if (b === id) total += v;
    }
    return total;
  }

  simplify() {
    const balance = new Map([...this.users.keys()].map((u) => [u, this.balanceOf(u)]));
    const payments = [];
    for (;;) {
      let debtor = null;
      let creditor = null;
      for (const [u, b] of balance) {
        if (b < 0 && (debtor === null || b < balance.get(debtor) || (b === balance.get(debtor) && u < debtor))) debtor = u;
        if (b > 0 && (creditor === null || b > balance.get(creditor) || (b === balance.get(creditor) && u < creditor))) creditor = u;
      }
      if (debtor === null) return payments;
      const amount = Math.min(-balance.get(debtor), balance.get(creditor));
      payments.push([debtor, creditor, amount]);
      balance.set(debtor, balance.get(debtor) + amount);
      balance.set(creditor, balance.get(creditor) - amount);
    }
  }

  owe(debtor, creditor, amount) {
    if (debtor === creditor || amount === 0) return;
    const [a, b] = debtor < creditor ? [debtor, creditor] : [creditor, debtor];
    const key = a + "|" + b;
    this.net.set(key, (this.net.get(key) || 0) + (debtor === a ? amount : -amount));
  }

  owed(from, to) {
    const [a, b] = from < to ? [from, to] : [to, from];
    const v = this.net.get(a + "|" + b) || 0;
    return Math.max(from === a ? v : -v, 0);
  }

  requireUser(id) {
    if (!this.users.has(id)) throw new Error("Unknown user " + id);
  }
}

function requireAmount(amount) {
  if (!Number.isInteger(amount) || amount < 1) throw new Error("Amount must be a whole number of paise, at least 1");
}`,
    py: `# Each split rule turns (amount, participants, values) into one share per participant.
# Adding a split type means adding a class here, not editing ExpenseManager.
class EqualSplit:
    def shares(self, amount, participants, values=None):
        n = len(participants)
        base = amount // n
        return [base + (1 if i < amount % n else 0) for i in range(n)]


class ExactSplit:
    def shares(self, amount, participants, values=None):
        check_values(participants, values, 0)
        if sum(values) != amount:
            raise ValueError("Exact amounts must add up to the total")
        return list(values)


class ProportionalSplit:
    # total = 100 for percentages; None means "the sum of the shares".
    def __init__(self, total, minimum):
        self.total = total
        self.minimum = minimum

    def shares(self, amount, participants, values=None):
        check_values(participants, values, self.minimum)
        if self.total is not None and sum(values) != self.total:
            raise ValueError(f"Percentages must add up to {self.total}")
        total = self.total if self.total is not None else sum(values)
        out = [amount * v // total for v in values]
        left = amount - sum(out)
        for i in range(left):
            out[i] += 1
        return out


def is_whole(x):
    return isinstance(x, int) and not isinstance(x, bool)


def check_values(participants, values, minimum):
    if not isinstance(values, list) or len(values) != len(participants):
        raise ValueError("Give one value per participant")
    if any(not is_whole(v) or v < minimum for v in values):
        raise ValueError(f"Values must be whole numbers >= {minimum}")


def require_amount(amount):
    if not is_whole(amount) or amount < 1:
        raise ValueError("Amount must be a whole number of paise, at least 1")


class ExpenseManager:
    def __init__(self):
        self.users = {}
        self.net = {}  # (a, b) with a < b: how much a owes b (negative: b owes a)
        self.splits = {
            "equal": EqualSplit(),
            "exact": ExactSplit(),
            "percent": ProportionalSplit(100, 0),
            "shares": ProportionalSplit(None, 1),
        }

    def add_user(self, id, name):
        if not isinstance(id, str) or not id:
            raise ValueError("Invalid user id")
        if id in self.users:
            raise ValueError(f"User {id} already exists")
        self.users[id] = name

    def add_expense(self, paid_by, amount, type, participants, values=None):
        self.require_user(paid_by)
        require_amount(amount)
        if not isinstance(participants, list) or not participants:
            raise ValueError("Add at least one participant")
        if len(set(participants)) != len(participants):
            raise ValueError("Participants must be unique")
        for u in participants:
            self.require_user(u)
        rule = self.splits.get(type)
        if rule is None:
            raise ValueError(f"Unknown split type {type}")
        shares = rule.shares(amount, participants, values)  # validates before anything changes
        for u, share in zip(participants, shares):
            self.owe(u, paid_by, share)

    def settle(self, from_, to, amount):
        self.require_user(from_)
        self.require_user(to)
        require_amount(amount)
        if amount > self.owed(from_, to):
            raise ValueError("Can't settle more than is owed")
        self.owe(to, from_, amount)

    def balances(self):
        out = []
        for (a, b), v in self.net.items():
            if v > 0:
                out.append([a, b, v])
            elif v < 0:
                out.append([b, a, -v])
        return sorted(out, key=lambda t: (t[0], t[1]))

    def balance_of(self, id):
        self.require_user(id)
        total = 0
        for (a, b), v in self.net.items():
            if a == id:
                total -= v
            elif b == id:
                total += v
        return total

    def simplify(self):
        balance = {u: self.balance_of(u) for u in self.users}
        payments = []
        while True:
            debtors = [u for u, b in balance.items() if b < 0]
            if not debtors:
                return payments
            creditors = [u for u, b in balance.items() if b > 0]
            debtor = min(debtors, key=lambda u: (balance[u], u))
            creditor = min(creditors, key=lambda u: (-balance[u], u))
            amount = min(-balance[debtor], balance[creditor])
            payments.append([debtor, creditor, amount])
            balance[debtor] += amount
            balance[creditor] -= amount

    def owe(self, debtor, creditor, amount):
        if debtor == creditor or amount == 0:
            return
        a, b = sorted((debtor, creditor))
        self.net[(a, b)] = self.net.get((a, b), 0) + (amount if debtor == a else -amount)

    def owed(self, from_, to):
        a, b = sorted((from_, to))
        v = self.net.get((a, b), 0)
        return max(v if from_ == a else -v, 0)

    def require_user(self, id):
        if id not in self.users:
            raise ValueError(f"Unknown user {id}")`,
  },
  scenarios: [
    {
      name: "Equal split with a remainder",
      stage: "core",
      visible: true,
      steps: [...add3(), { call: "addExpense", args: ["A", 1000, "equal", ["A", "B", "C"]], note: "334 + 333 + 333" }, { call: "balances", args: [], expect: [["B", "A", 333], ["C", "A", 333]] }, { call: "balanceOf", args: ["A"], expect: 666 }, { call: "balanceOf", args: ["B"], expect: -333 }],
    },
    {
      name: "Exact amounts",
      stage: "core",
      visible: true,
      steps: [...add3(), { call: "addExpense", args: ["A", 500, "exact", ["B", "C"], [200, 300]] }, { call: "balances", args: [], expect: [["B", "A", 200], ["C", "A", 300]] }],
    },
    {
      name: "Percentages that don't divide evenly",
      stage: "core",
      steps: [...add3(), { call: "addExpense", args: ["A", 999, "percent", ["A", "B", "C"], [50, 25, 25]], note: "499 + 249 + 249, then 2 left over" }, { call: "balances", args: [], expect: [["B", "A", 250], ["C", "A", 249]] }],
    },
    {
      name: "Debts net out between two people",
      stage: "core",
      visible: true,
      steps: [
        { call: "addUser", args: ["A", "Asha"] },
        { call: "addUser", args: ["B", "Bilal"] },
        { call: "addExpense", args: ["A", 600, "equal", ["A", "B"]] },
        { call: "addExpense", args: ["B", 200, "equal", ["A", "B"]] },
        { call: "balances", args: [], expect: [["B", "A", 200]] },
        { call: "balanceOf", args: ["B"], expect: -200 },
        { call: "balanceOf", args: ["A"], expect: 200 },
      ],
    },
    {
      name: "Settling up",
      stage: "core",
      steps: [
        { call: "addUser", args: ["A", "Asha"] },
        { call: "addUser", args: ["B", "Bilal"] },
        { call: "addExpense", args: ["A", 600, "equal", ["A", "B"]] },
        { call: "settle", args: ["B", "A", 300] },
        { call: "balances", args: [], expect: [] },
        { call: "settle", args: ["B", "A", 1], throws: true },
        { call: "balanceOf", args: ["A"], expect: 0 },
      ],
    },
    {
      name: "Payer outside the split",
      stage: "core",
      steps: [...add3(), { call: "addExpense", args: ["A", 900, "equal", ["B", "C"]] }, { call: "balances", args: [], expect: [["B", "A", 450], ["C", "A", 450]] }],
    },
    {
      name: "Bad input is rejected and changes nothing",
      stage: "core",
      steps: [
        { call: "addUser", args: ["A", "Asha"] },
        { call: "addUser", args: ["B", "Bilal"] },
        { call: "addUser", args: ["A", "Again"], throws: true },
        { call: "addExpense", args: ["A", 0, "equal", ["A", "B"]], throws: true },
        { call: "addExpense", args: ["A", 100, "exact", ["A", "B"], [50, 40]], throws: true },
        { call: "addExpense", args: ["A", 100, "percent", ["A", "B"], [50, 40]], throws: true },
        { call: "addExpense", args: ["Z", 100, "equal", ["A"]], throws: true },
        { call: "addExpense", args: ["A", 100, "equal", ["A", "Q"]], throws: true },
        { call: "addExpense", args: ["A", 100, "equal", ["B", "B"]], throws: true },
        { call: "addExpense", args: ["A", 100, "by-vibes", ["A", "B"]], throws: true },
        { call: "addExpense", args: ["A", 100, "equal", []], throws: true },
        { call: "balances", args: [], expect: [] },
      ],
    },
    {
      name: "Settlements can't overpay",
      stage: "core",
      steps: [
        { call: "addUser", args: ["A", "Asha"] },
        { call: "addUser", args: ["B", "Bilal"] },
        { call: "addExpense", args: ["A", 100, "exact", ["B"], [100]] },
        { call: "settle", args: ["B", "A", 150], throws: true },
        { call: "settle", args: ["A", "B", 10], throws: true },
        { call: "settle", args: ["B", "A", 0], throws: true },
        { call: "balances", args: [], expect: [["B", "A", 100]] },
      ],
    },
    {
      name: "Shares: 2 : 1 : 1",
      stage: "extension",
      visible: true,
      steps: [...add3(), { call: "addExpense", args: ["A", 1000, "shares", ["A", "B", "C"], [2, 1, 1]] }, { call: "balances", args: [], expect: [["B", "A", 250], ["C", "A", 250]] }],
    },
    {
      name: "Shares with leftovers, and invalid shares",
      stage: "extension",
      steps: [
        ...add3(),
        { call: "addExpense", args: ["A", 100, "shares", ["A", "B", "C"], [1, 1, 1]], note: "34 + 33 + 33" },
        { call: "addExpense", args: ["A", 100, "shares", ["A", "B"], [1, 0]], throws: true },
        { call: "balances", args: [], expect: [["B", "A", 33], ["C", "A", 33]] },
      ],
    },
    {
      name: "Simplify a chain",
      stage: "extension",
      visible: true,
      steps: [
        ...add3(),
        { call: "addExpense", args: ["A", 300, "equal", ["A", "B", "C"]] },
        { call: "addExpense", args: ["B", 300, "equal", ["A", "B", "C"]] },
        { call: "balances", args: [], expect: [["C", "A", 100], ["C", "B", 100]] },
        { call: "simplify", args: [], expect: [["C", "A", 100], ["C", "B", 100]] },
      ],
    },
    {
      name: "Simplify a triangle to nothing",
      stage: "extension",
      steps: [
        ...add3(),
        { call: "addExpense", args: ["B", 100, "exact", ["A"], [100]] },
        { call: "addExpense", args: ["C", 100, "exact", ["B"], [100]] },
        { call: "addExpense", args: ["A", 100, "exact", ["C"], [100]] },
        { call: "balances", args: [], expect: [["A", "B", 100], ["B", "C", 100], ["C", "A", 100]] },
        { call: "simplify", args: [], expect: [] },
        { call: "balances", args: [], expect: [["A", "B", 100], ["B", "C", 100], ["C", "A", 100]], note: "simplify doesn't change balances" },
      ],
    },
    {
      name: "Simplify settles the biggest first",
      stage: "extension",
      steps: [
        ...add3(),
        { call: "addUser", args: ["D", "Divya"] },
        { call: "addExpense", args: ["A", 1200, "exact", ["B", "C", "D"], [600, 400, 200]] },
        { call: "addExpense", args: ["D", 300, "exact", ["C"], [300]] },
        { call: "simplify", args: [], expect: [["C", "A", 700], ["B", "A", 500], ["B", "D", 100]] },
      ],
    },
  ],
  generated: [
    { name: "Busy group: 30 friends, 3,000 calls", stage: "core", limitMs: 3000, gen: (r) => busyGroup(r, 30, 3000, false) },
    { name: "Busy group with shares, then simplify", stage: "extension", limitMs: 3000, gen: (r) => busyGroup(r, 30, 3000, true) },
  ],
  hints: [
    "Start from the data, not the classes: what's the smallest thing you must remember to answer 'who owes whom'?",
    "Keep one net number per pair of users. Each split type only decides the shares, so make it its own small class with one method; ExpenseManager just applies the shares.",
    "Validate everything and compute all shares first; only then update balances. For simplify, copy the balances and repeatedly match the most-negative user with the most-positive one.",
  ],
  review: [
    "Each split type lives in its own class behind one method, so the extension added a class instead of editing a switch.",
    "Balances are netted per pair in one place (one owe/net method), not duplicated across methods.",
    "Every input is validated before any state changes, so a failed call can't leave half an expense behind.",
    "Money is whole paise throughout; no floats appear anywhere.",
    "Names say what things are (shares, net, owed), and no method is longer than about 20 lines.",
    "You could demo it: a short script that adds users, a few bills, prints balances and settles up.",
  ],
  walkthrough: {
    design:
      "Model the minimum state: users, and one signed number per pair saying how much the first owes the second. Expenses don't need to be stored to answer the questions asked (store them if history is a requirement). Split rules are strategies: each turns an amount and participants into shares, so adding 'shares' is a new class rather than another branch in a growing switch. ExpenseManager validates, asks the rule for shares, then records one debt per participant through a single netting method. Simplify works on a copy of everyone's overall balance, which is why it never changes the real balances.",
    classes: [
      { name: "ExpenseManager", role: "Public API: validates input, applies shares, answers balance questions." },
      { name: "SplitRule (EqualSplit, ExactSplit, ProportionalSplit)", role: "Strategy: amount + participants + values → shares. Percent and shares reuse ProportionalSplit with different settings." },
      { name: "net (pair → amount)", role: "The single source of truth for debts, netted on every write." },
    ],
    tradeoffs: [
      "Storing net per pair answers balances in O(pairs) without replaying history; storing every expense instead makes history and edits easy but balances slower.",
      "Greedy simplify is fast and deterministic but not always the minimum number of payments (that problem is NP-hard); say so if asked.",
      "Integer paise avoid rounding bugs; a Money value object would make the unit explicit in a larger codebase.",
      "For concurrent requests, guard the manager with a lock or make updates per pair atomic.",
    ],
    followUps: [
      "Groups: balances within a group vs across all groups.",
      "Edit or delete an expense (now you need to store expenses).",
      "Multiple currencies.",
      "Make it thread-safe when two people add bills at once.",
    ],
  },
};
