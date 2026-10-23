import { hotSpots, pathsOf, type DesignScenario } from "@/lib/design/evaluate";
import { catalog, type NodeKind } from "@/lib/design/catalog";
import { fmtRate, type Broken, type FlowDef, type Hop, type Route } from "@/lib/design/engine";
import type { Design, Graph } from "@/lib/design/graph";

const PAYMENTS = 800; // card and UPI payments per second at the dinner peak
const STATUS = 4_000; // "is my payment done?" checks per second from the app
const RETRY = 0.05; // share of payments the app retries after a timeout on a flaky network
const PAY_MS = 2000;
const HEADROOM = 0.7;
const BUDGET = 2000;

function entry(g: Graph): { hops: Hop[] } | { broken: string } {
  if (g.edge("client", "lb") && g.edge("lb", "app")) return { hops: [{ kind: "lb" }, { kind: "app" }] };
  if (g.edge("client", "app")) {
    if (g.count("app") > 1) return { broken: "Several app servers need a load balancer in front of them." };
    return { hops: [{ kind: "app" }] };
  }
  return { broken: "Customers can't reach the payment service. Connect Users → Load balancer → App servers." };
}

// Paying: record the intent (with its idempotency key), charge the provider, then write the ledger entries.
const pay: FlowDef = {
  id: "pay",
  label: "Pay",
  route: (g, t): Route | Broken => {
    const rate = t.paymentsPerSec;
    const e = entry(g);
    if ("broken" in e) return { broken: e.broken };
    const hops = [...e.hops];
    const idem = g.decisions.idempotency;
    if (!idem) return { broken: "Decide what stops a retried payment from charging twice.", rate, hops };
    if (idem === "cache") {
      if (!g.edge("app", "cache")) return { broken: "Idempotency keys in the cache: link the app servers to one.", rate, hops };
      hops.push({ kind: "cache", write: true, from: "app" });
    }
    if (!g.edge("app", "sql")) return { broken: "Payments must be recorded durably: link the app servers to the SQL primary.", rate, hops };
    hops.push({ kind: "sql", write: true, from: "app" }); // the payment intent, before any money moves
    if (!g.edge("app", "psp")) {
      if (g.wired("app", "psp")) return { broken: "The payment provider is down: card payments can't be taken.", rate, hops };
      return { broken: "Nothing charges the card: link the app servers to a payment provider.", rate, hops };
    }
    hops.push({ kind: "psp", from: "app" });
    hops.push({ kind: "sql", write: true, from: "app" }); // the ledger entries and the new status, in one transaction
    return { rate, hops };
  },
};

// Checking status: from a read replica if there is one, otherwise from the primary.
const status: FlowDef = {
  id: "status",
  label: "Check status",
  route: (g, t): Route | Broken => {
    const rate = t.statusPerSec;
    const e = entry(g);
    if ("broken" in e) return { broken: e.broken };
    const src: NodeKind | null = g.edge("app", "replica") ? "replica" : g.edge("app", "sql") ? "sql" : null;
    if (!src) return { broken: "Status lives with the payments: link the app servers to the database.", rate, hops: e.hops };
    return { rate, hops: [...e.hops, { kind: src, from: "app" }] };
  },
};

// Reconciliation: a scheduled job matches every payment against the provider's settlement files.
const reconcile: FlowDef = {
  id: "reconcile",
  label: "Reconcile",
  route: (g, t): Route | Broken => {
    if (g.decisions.reconcile !== "daily") return { rate: 0, hops: [] };
    const rate = t.paymentsPerSec;
    if (!g.has("worker")) return { broken: "Reconciliation needs a job runner: add workers." };
    const hops: Hop[] = [{ kind: "worker" }];
    if (!g.edge("worker", "objstore")) return { broken: "The provider's settlement files land in object storage: link the workers to it.", rate, hops };
    hops.push({ kind: "objstore", from: "worker" });
    const src: NodeKind | null = g.edge("worker", "replica") ? "replica" : g.edge("worker", "sql") ? "sql" : null;
    if (!src) return { broken: "Reconciliation compares against the ledger: link the workers to a read replica.", rate, hops };
    hops.push({ kind: src, from: "worker" });
    return { rate, hops };
  },
};

const reference: Design = {
  nodes: [
    { kind: "client", count: 1, x: 0, y: 0 },
    { kind: "lb", count: 2, x: 0, y: 0 },
    { kind: "app", count: 3, x: 0, y: 0 },
    { kind: "sql", count: 1, x: 0, y: 0 },
    { kind: "replica", count: 2, x: 0, y: 0 },
    { kind: "psp", count: 1, x: 0, y: 0 },
    { kind: "worker", count: 2, x: 0, y: 0 },
    { kind: "objstore", count: 2, x: 0, y: 0 },
  ],
  edges: [
    ["client", "lb"],
    ["lb", "app"],
    ["app", "sql"],
    ["app", "replica"],
    ["sql", "replica"],
    ["app", "psp"],
    ["worker", "objstore"],
    ["worker", "replica"],
  ],
  decisions: { idempotency: "db", ledger: "double", reconcile: "daily" },
};

const live = ["pay", "status", "reconcile"];
const firstBroken = (s: { flows: Record<string, { ok: boolean; reason?: string }> }, ids = live) => ids.map((id) => s.flows[id]).find((f) => !f.ok);

export const paymentsLab: DesignScenario = {
  id: "payments",
  title: "Every rupee, exactly once",
  statement: `Tiffin takes card and UPI payments for every order, through an outside payment provider, and later pays restaurants and riders their share. At the dinner peak that's **800 payments a second**.

Networks are flaky: the app sometimes times out and retries. The provider is slow, occasionally times out itself, and sends a settlement file each day saying what it actually charged. Design the payment service so that nobody is charged twice, every rupee is accounted for, and mismatches with the provider are caught. The simulator runs your design at peak, then knocks out one machine at a time.`,
  functional: [
    "Charge a customer for an order through the payment provider; show the payment's status in the app.",
    "Record every movement of money so balances (customers, Tiffin, restaurants, riders) can be derived and audited.",
    "Match Tiffin's records against the provider's settlement files every day.",
  ],
  nonFunctional: [
    "A retried request never charges twice, even after a machine fails.",
    `A payment completes in under ${PAY_MS / 1000} seconds at peak.`,
    "Status checks don't load the primary database.",
    `Losing any one machine doesn't lose or double any money; every machine stays under ${HEADROOM * 100}% busy.`,
    `Under $${BUDGET.toLocaleString("en-US")} a month (provider fees are per payment, not included).`,
  ],
  estimates: [
    { label: "Payments", value: "800 / s", how: "Dinner peak, about 10× the daily average of 80 a second (7 million a day)." },
    { label: "Retries", value: "~40 / s", how: "About 5% of requests time out on a phone's network and are sent again. Without protection, each one is a second charge." },
    { label: "Writes on the primary", value: "1,600 / s", how: "Two transactions a payment: the intent (with its idempotency key) before calling the provider, then the ledger entries and new status after. 53% of a 3,000 writes/s primary." },
    { label: "Status checks", value: "4,000 / s", how: "The app polls while the payment is in flight. On the primary that would add 40% read load on top of the writes." },
    { label: "Settlement rows", value: "7 million a day", how: "One per payment, in the provider's daily file. Matching them is a batch job that reads the ledger from a replica." },
  ],
  traffic: { paymentsPerSec: PAYMENTS, statusPerSec: STATUS },
  flows: [pay, status, reconcile],
  metrics: [
    { flow: "pay", label: "Pay" },
    { flow: "status", label: "Check status" },
  ],
  trafficLabel: (f) => `${fmtRate(PAYMENTS * f)} payments, ${fmtRate(STATUS * f)} status checks`,
  decisions: [
    {
      id: "idempotency",
      question: "The app times out and sends the same payment again. What stops a second charge?",
      options: [
        { value: "none", label: "Nothing: every request is a new payment", consequence: "Simple, and about 40 customers a second are charged twice at peak." },
        { value: "cache", label: "An idempotency key, remembered in the cache", consequence: "Fast. But the key and the payment live in different places: if a cache node fails or evicts the key, the retry charges again." },
        { value: "db", label: "An idempotency key with a unique constraint, stored in the same transaction as the payment", consequence: "A retry finds the key and gets the original result back. The key can't exist without the payment, or the payment without the key." },
      ],
    },
    {
      id: "ledger",
      question: "How is money recorded?",
      options: [
        { value: "balance", label: "A balance column per account, updated in place", consequence: "Easy to read. But history is lost, a bug or a race silently changes totals, and there's nothing to reconcile against." },
        { value: "double", label: "A double-entry ledger: every movement is a debit and a credit that sum to zero", consequence: "Append-only; balances are sums of entries. Any mistake shows up as books that don't balance, and every rupee has a trail." },
      ],
    },
    {
      id: "reconcile",
      question: "How do you know Tiffin's records match what the provider actually did?",
      options: [
        { value: "trust", label: "Trust our own records", consequence: "Timeouts leave payments whose outcome we never learned; they stay wrong forever." },
        { value: "daily", label: "A daily job matches every payment against the provider's settlement file", consequence: "Unknown outcomes are resolved, and any mismatch (charged but not recorded, or the reverse) is flagged within a day." },
      ],
    },
  ],
  criteria: [
    {
      id: "pay",
      label: "Payments go through",
      short: "Payments",
      focus: ({ sim }) => pathsOf(sim, ["pay"]),
      check: ({ sim }) => {
        const f = sim.flows.pay;
        return { pass: f.ok, detail: f.ok ? `Path: Users → ${f.path.map((k) => catalog[k].short).join(" → ")}` : f.reason ?? "" };
      },
    },
    {
      id: "fast",
      label: `A payment completes in under ${PAY_MS / 1000} s`,
      short: `< ${PAY_MS / 1000} s`,
      focus: ({ sim }) => pathsOf(sim, ["pay"]),
      check: ({ sim }) => {
        const f = sim.flows.pay;
        if (!f.ok) return { pass: false, detail: "Payments don't go through yet." };
        const provider = f.hops.find((h) => h.kind === "psp")?.ms ?? 0;
        return { pass: f.latencyMs <= PAY_MS, detail: `${Math.round(f.latencyMs)} ms, of which the provider takes ${Math.round(provider)} ms.` };
      },
    },
    {
      id: "status",
      label: "Customers can check status",
      short: "Status",
      focus: ({ sim }) => pathsOf(sim, ["status"]),
      check: ({ sim }) => {
        const f = sim.flows.status;
        return { pass: f.ok, detail: f.ok ? `Path: Users → ${f.path.map((k) => catalog[k].short).join(" → ")}` : f.reason ?? "" };
      },
    },
    {
      id: "once",
      label: "A retry never charges twice, even after a failure",
      short: "Charged once",
      focus: ({ design }) => design.nodes.filter((n) => ["sql", "cache"].includes(n.kind)).map((n) => n.kind),
      check: ({ design }) => {
        const i = design.decisions.idempotency;
        if (!i) return { pass: false, detail: "Decide what stops a retry from charging twice." };
        if (i === "none") return { pass: false, detail: `${RETRY * 100}% of payments are retried: about ${PAYMENTS * RETRY} customers a second charged twice at peak.` };
        if (i === "cache") return { pass: false, detail: "When a cache node fails (or evicts under memory pressure), its keys are gone, and the retries that follow are charged again. The key must live where the payment lives." };
        return { pass: true, detail: "The key is written with the payment intent in one transaction, under a unique constraint: a retry finds it and gets the first result." };
      },
    },
    {
      id: "books",
      label: "Every rupee is in a balanced ledger",
      short: "Ledger",
      check: ({ design }) => {
        const l = design.decisions.ledger;
        if (!l) return { pass: false, detail: "Decide how money is recorded." };
        if (l === "double") return { pass: true, detail: "Each payment writes balanced entries (customer −, Tiffin +; later Tiffin −, restaurant and rider +). The sum of all entries is always zero." };
        return { pass: false, detail: "A balance updated in place keeps no history: two concurrent updates can lose one, and nobody can say where a rupee went." };
      },
    },
    {
      id: "reconcile",
      label: "Mismatches with the provider are caught within a day",
      short: "Reconciled",
      focus: ({ sim }) => pathsOf(sim, ["reconcile"]),
      check: ({ design, sim }) => {
        if (design.decisions.reconcile !== "daily") return { pass: false, detail: "When the provider times out, we don't know whether it charged. Without reconciliation those payments stay wrong." };
        const f = sim.flows.reconcile;
        return { pass: f.ok, detail: f.ok ? `${fmtRate(f.rate)} payments matched along ${f.path.map((k) => catalog[k].short).join(" → ")}.` : f.reason ?? "" };
      },
    },
    {
      id: "headroom",
      label: `Every machine under ${HEADROOM * 100}% at peak`,
      short: "Headroom",
      focus: ({ sim }) => (Object.keys(sim.load) as NodeKind[]).filter((k) => (sim.load[k]?.utilization ?? 0) > HEADROOM * 0.85),
      check: ({ sim }) => {
        const hot = hotSpots(sim, HEADROOM);
        return { pass: hot.length === 0, detail: hot.length ? `Too busy: ${hot.join(", ")}.` : sim.bottleneck ? `Busiest: ${catalog[sim.bottleneck.kind].label} at ${Math.round(sim.bottleneck.utilization * 100)}%.` : "" };
      },
    },
    {
      id: "failures",
      label: "Survives losing any one machine",
      short: "Failures",
      focus: ({ sim }) => pathsOf(sim, live),
      check: ({ sim, failures }) => {
        if (firstBroken(sim)) return { pass: false, detail: "Get payments, status and reconciliation working first." };
        for (const f of failures) {
          const ids = f.kind === "psp" ? live.filter((id) => id !== "pay") : live;
          const bad = firstBroken(f.sim, ids);
          if (bad) return { pass: false, detail: `${f.note} Then: ${bad.reason ?? ""}` };
        }
        return { pass: true, detail: `Knocked out one machine of each of ${failures.length} components; nothing was lost (a provider outage pauses card payments, and nothing is half-recorded).` };
      },
    },
    {
      id: "cost",
      label: `Under $${BUDGET.toLocaleString("en-US")} a month`,
      short: "Budget",
      check: ({ sim }) => ({ pass: sim.costPerMonth <= BUDGET, detail: `$${sim.costPerMonth.toLocaleString("en-US")} a month.` }),
    },
  ],
  start: { nodes: [{ kind: "client", count: 1, x: 0, y: 200 }], edges: [], decisions: {} },
  reference,
  naive: {
    nodes: [
      { kind: "client", count: 1, x: 0, y: 0 },
      { kind: "app", count: 1, x: 0, y: 0 },
      { kind: "sql", count: 1, x: 0, y: 0 },
      { kind: "psp", count: 1, x: 0, y: 0 },
    ],
    edges: [["client", "app"], ["app", "sql"], ["app", "psp"]],
    decisions: { idempotency: "none", ledger: "balance", reconcile: "trust" },
  },
  wrong: [
    { name: "No idempotency keys", design: { ...reference, decisions: { ...reference.decisions, idempotency: "none" } }, fails: "once" },
    {
      name: "Idempotency keys in the cache",
      design: { ...reference, nodes: [...reference.nodes, { kind: "cache", count: 2, x: 0, y: 0 }], edges: [...reference.edges, ["app", "cache"]], decisions: { ...reference.decisions, idempotency: "cache" } },
      fails: "once",
    },
    { name: "A balance column instead of a ledger", design: { ...reference, decisions: { ...reference.decisions, ledger: "balance" } }, fails: "books" },
    { name: "Status read from the primary", design: { ...reference, edges: reference.edges.filter(([a, b]) => !(a === "app" && b === "replica")) }, fails: "headroom" },
    { name: "Trust our own records", design: { ...reference, decisions: { ...reference.decisions, reconcile: "trust" } }, fails: "reconcile" },
  ],
  pinned: { cost: 1450, latencyMs: { pay: 1028.43, status: 24.92, reconcile: 44.41 }, utilization: { lb: 0.048, app: 0.5333, sql: 0.5333, replica: 0.24, psp: 0.16, worker: 0.08, objstore: 0.04 } },
  tolerates: { psp: { flows: ["pay"], why: "card payments pause until the provider is back (or traffic fails over to a second provider); nothing is half-recorded." } },
  hints: [
    "Money needs three guarantees: charge once, record everything, and find out when your records and the provider's disagree. Which of those can a cache, a retry or a timeout break?",
    "Give every payment an idempotency key from the client, stored with the payment in one transaction under a unique constraint. Record money as double-entry ledger lines. Keep status reads on replicas, and reconcile daily against the provider's settlement file.",
    "Users → load balancers (2) → app servers (3) → SQL primary (intents and ledger) and the payment provider; status from read replicas (2); workers (2) read settlement files from object storage (2) and the ledger from the replicas. Keys in the database, double entry, daily reconciliation.",
  ],
  walkthrough: {
    summary:
      "A payment is a small state machine around a slow, unreliable outside call. Before calling the provider, write a payment intent with the client's idempotency key in one transaction (a unique constraint makes a retry return the first result instead of charging again). Call the provider, then record the outcome as balanced double-entry ledger lines in one transaction. If the provider times out, the payment stays 'unknown' and the daily reconciliation against the provider's settlement file settles it. Status reads go to replicas so the primary does only the writes that matter.",
    steps: [
      "Requirements: charge once, record every movement, show status, reconcile with the provider, later pay out restaurants and riders.",
      "Numbers: 800 payments/s at peak, ~40 retries/s, 1,600 writes/s on the primary (53%), 4,000 status reads/s, 7 M settlement rows a day.",
      "Intent: INSERT payment (id, idempotency_key UNIQUE, amount, status 'pending'); a duplicate key returns the existing payment.",
      "Charge: call the provider with the same key (providers support it too), with a timeout. Success or failure → one transaction: status + ledger entries (debit customer, credit Tiffin's holding account). Timeout → status 'unknown'.",
      "Reconcile: each day, a job reads the provider's settlement file from object storage and the ledger from a replica, matches by payment id, resolves 'unknown' payments, and flags any mismatch for a person.",
      "Payouts: a later job moves money from Tiffin's holding account to restaurants and riders, again as balanced entries.",
    ],
    tradeoffs: [
      "Keys in the database cost a little latency, but a key that can vanish (cache) is no guarantee at all.",
      "Double entry is more rows than a balance column, but it's append-only, auditable, and errors show up as books that don't balance.",
      "Calling the provider synchronously keeps the customer's flow simple; for slow methods (bank transfers) make it asynchronous and notify on completion.",
      "Reconciliation is a batch job, so mismatches are caught within a day, not instantly; instant checks would need the provider's webhooks, which can also be late or duplicated.",
    ],
    followUps: [
      "Refunds and partial refunds: new ledger entries in the other direction, never edits.",
      "A second payment provider for failover, and routing by method or cost.",
      "Currency: store amounts as integers in the smallest unit, with the currency, never floats.",
      "Webhooks from the provider: verify signatures, handle them idempotently, and expect them late, duplicated or out of order.",
    ],
  },
};
