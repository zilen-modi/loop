import { hotSpots, pathsOf, type DesignScenario } from "@/lib/design/evaluate";
import { catalog, type NodeKind } from "@/lib/design/catalog";
import { fmtRate, simulate, type Broken, type FlowDef, type Hop, type Route } from "@/lib/design/engine";
import type { Design, Graph } from "@/lib/design/graph";

const CALLS = 30_000; // per second, at peak
const BIGGEST = 0.3; // the largest partner's share of all calls
const CHECK_MS = 2;
const HEADROOM = 0.7;
const BUDGET = 3500;
const STORES: NodeKind[] = ["cache", "kv", "sql"];

/** The counter store the gateway is wired to, even if it's down right now. */
const counterStore = (g: Graph) => STORES.find((k) => g.wired("limiter", k)) ?? null;

// One flow: a partner's API call. Users → LB → (gateway [→ counter store]) → API servers → data.
const call: FlowDef = {
  id: "call",
  label: "API call",
  route: (g, t): Route | Broken => {
    const rate = t.callsPerSec;
    if (!g.edge("client", "lb")) return { broken: "Partners can't reach the API. Connect Users → Load balancer." };
    const hops: Hop[] = [{ kind: "lb" }];
    const gated = g.edge("lb", "limiter") && g.edge("limiter", "app");
    if (gated) hops.push({ kind: "limiter" });
    else if (!g.edge("lb", "app")) return { broken: "The load balancer can't reach the API servers, directly or through the gateway.", rate, hops };
    const mode = g.decisions.counters;
    if (gated && (mode === "central" || mode === "sync")) {
      const store = counterStore(g);
      if (!store) return { broken: "Shared counts need the gateway linked to a counter store.", rate, hops };
      if (!g.has(store)) {
        if (mode === "central" && g.decisions.outage !== "open") return { broken: "The counter store is down and the gateway fails closed: every call is refused.", rate, hops };
        // fail open, or syncing: carry on with local counts
      } else if (mode === "central") hops.push({ kind: store, write: true, from: "limiter" });
      else hops.push({ kind: store, write: true, onPath: false, from: "limiter", share: Math.min(1, (g.count("limiter") * 10) / rate) });
    }
    hops.push({ kind: "app", from: gated ? "limiter" : "lb" });
    const data = g.firstLinked(["app"], ["kv", "replica", "sql"]);
    if (!data) return { broken: "The API servers have no database for menus and prices.", rate, hops };
    hops.push({ kind: data, from: "app" });
    return { rate, hops };
  },
};

const reference: Design = {
  nodes: [
    { kind: "client", count: 1, x: 0, y: 0 },
    { kind: "lb", count: 2, x: 0, y: 0 },
    { kind: "limiter", count: 6, x: 0, y: 0 },
    { kind: "app", count: 15, x: 0, y: 0 },
    { kind: "cache", count: 2, x: 0, y: 0 },
    { kind: "kv", count: 3, x: 0, y: 0 },
  ],
  edges: [
    ["client", "lb"],
    ["lb", "limiter"],
    ["limiter", "app"],
    ["limiter", "cache"],
    ["app", "kv"],
  ],
  decisions: { counters: "central", routing: "round-robin", outage: "open" },
};

const swap = (d: Design, from: NodeKind, to: NodeKind): Design => ({ ...d, edges: d.edges.map(([a, b]) => [a === from ? to : a, b === from ? to : b] as [NodeKind, NodeKind]) });

export const rateLimiterLab: DesignScenario = {
  id: "distributed-rate-limiter",
  title: "Rate limits across a fleet of gateways",
  statement: `Tiffin's partner API is used by 50,000 restaurants and chains to update menus, prices and opening hours. Each partner has a limit on its plan, and limits have to hold however many gateway machines are running. Last month a buggy integration sent 40,000 calls in a minute and slowed everyone down.

Design the rate limiting in front of the API. Choose where counts live, how calls are spread across gateways, and what happens when the counter store is unavailable. The simulator runs your design at **peak traffic** and then knocks out one machine at a time.`,
  functional: [
    "Every API call is checked against its partner's limit before it reaches the API servers.",
    "Calls within the limit go through; others get a 429 with a retry time.",
    "Limits are per partner, not per machine.",
  ],
  nonFunctional: [
    "Limits are accurate to within 10%, however many gateway machines are running.",
    `The limit check adds at most ${CHECK_MS} ms to a call.`,
    "If the counter store is unreachable, partners can still use the API.",
    "No single partner, however big, can overload a gateway machine.",
    `Losing any one machine doesn't stop calls; every machine stays under ${HEADROOM * 100}% busy; under $${BUDGET.toLocaleString("en-US")} a month.`,
  ],
  estimates: [
    { label: "Calls at peak", value: "30,000 / s", how: "Partners sync menus before lunch and dinner: about 3,000 / s on average, 10× at the peaks." },
    { label: "The biggest partner", value: "≈ 9,000 / s", how: "A national chain with 900 outlets sends about 30% of all calls. Its plan allows it." },
    { label: "Counter updates", value: "30,000 / s", how: "One increment per call if every call checks a shared counter." },
    { label: "Counter memory", value: "≈ 5 MB", how: "50,000 partners × ~100 bytes (key, tokens, last refill time). Tiny: it fits in one cache node with room to spare." },
    { label: "Network round trip", value: "≈ 0.5–1 ms", how: "Inside one data centre. That's the price of a shared counter on every call." },
  ],
  traffic: { callsPerSec: CALLS },
  flows: [call],
  metrics: [{ flow: "call", label: "API call" }],
  trafficLabel: (f) => `${fmtRate(CALLS * f)} API calls`,
  decisions: [
    {
      id: "counters",
      question: "Where are the counts kept?",
      options: [
        { value: "central", label: "In a shared counter store, checked on every call", consequence: "Exact: every gateway sees the same count. Every call pays a round trip to the store, so it must be in memory and close by. If the store goes down, you need a plan." },
        { value: "local", label: "On each gateway machine, on its own", consequence: "No extra hop, nothing shared to fail. But a partner whose calls are spread over N gateways is counted N times separately." },
        { value: "sync", label: "On each gateway, synced to a shared store every 100 ms", consequence: "No hop on the call path and close to exact: counts lag by at most about 100 ms. More moving parts to build and explain." },
      ],
    },
    {
      id: "routing",
      question: "How does the load balancer pick a gateway?",
      options: [
        { value: "round-robin", label: "Round robin (any gateway)", consequence: "Load spreads evenly, whatever the partner. Each partner's calls land on every gateway." },
        { value: "by-partner", label: "By partner (consistent hashing)", consequence: "A partner always lands on the same gateway, so local counts are exact. But one huge partner's whole load lands on one machine." },
      ],
    },
    {
      id: "outage",
      question: "If the counter store can't be reached?",
      options: [
        { value: "open", label: "Fail open: let calls through", consequence: "The API keeps working, without limits until the store is back. Alert on it; most public APIs choose this." },
        { value: "closed", label: "Fail closed: refuse calls", consequence: "Limits always hold, but a counter-store outage takes the whole API down with it." },
      ],
    },
  ],
  criteria: [
    {
      id: "calls",
      label: "API calls get through",
      short: "Calls",
      focus: ({ sim }) => pathsOf(sim, ["call"]),
      check: ({ sim }) => {
        const f = sim.flows.call;
        return { pass: f.ok, detail: f.ok ? `Path: Users → ${f.path.map((k) => catalog[k].short).join(" → ")}` : f.reason ?? "" };
      },
    },
    {
      id: "enforced",
      label: "Every call passes the rate limit",
      short: "Enforced",
      focus: ({ design }) => design.nodes.filter((n) => n.kind === "lb" || n.kind === "limiter").map((n) => n.kind),
      check: ({ sim }) => {
        const on = sim.flows.call.path.includes("limiter");
        return { pass: on, detail: on ? "Calls go through the gateway before the API servers." : "Calls reach the API servers without passing a rate-limit gateway: Users → LB → Gateway → API servers." };
      },
    },
    {
      id: "accurate",
      label: "Limits are accurate to within 10%",
      short: "Accurate",
      focus: ({ design }) => design.nodes.filter((n) => ["lb", "limiter", "cache", "kv", "sql"].includes(n.kind)).map((n) => n.kind),
      check: ({ design, sim }) => {
        const d = design.decisions;
        if (!d.counters || !d.routing) return { pass: false, detail: "Decide where counts live and how the load balancer picks a gateway." };
        if (!sim.flows.call.path.includes("limiter")) return { pass: false, detail: "There's no gateway enforcing limits yet." };
        const n = design.nodes.find((x) => x.kind === "limiter")?.count ?? 0;
        if (d.counters === "central") return { pass: true, detail: "Every gateway checks the same counter: exact." };
        if (d.counters === "sync") return { pass: true, detail: "Counts are shared every 100 ms: within a few percent." };
        if (d.routing === "by-partner" || n === 1) return { pass: true, detail: "Each partner always lands on the same gateway, so its local count is exact." };
        return { pass: false, detail: `Each of ${n} gateways counts a partner's calls on its own. Spread round robin, a partner can get up to ${n}× its limit through.` };
      },
    },
    {
      id: "fast",
      label: `The limit check adds at most ${CHECK_MS} ms`,
      short: `≤ ${CHECK_MS} ms check`,
      focus: ({ design }) => design.nodes.filter((n) => ["limiter", "cache", "kv", "sql"].includes(n.kind)).map((n) => n.kind),
      check: ({ sim }) => {
        const f = sim.flows.call;
        if (!f.ok) return { pass: false, detail: "Calls don't get through yet." };
        const hop = f.hops.find((h) => STORES.includes(h.kind) && f.path.indexOf(h.kind) < f.path.indexOf("app"));
        if (!hop) return { pass: true, detail: "Counts are checked in the gateway's memory: no extra hop." };
        return { pass: hop.ms <= CHECK_MS, detail: `The ${catalog[hop.kind].label.toLowerCase()} adds ${hop.ms.toFixed(1)} ms to every call${hop.ms > CHECK_MS ? ". Counters belong in an in-memory store." : "."}` };
      },
    },
    {
      id: "store-down",
      label: "Partners can still call the API if the counter store is down",
      short: "Store outage",
      focus: ({ design }) => design.nodes.filter((n) => ["limiter", "cache", "kv", "sql"].includes(n.kind)).map((n) => n.kind),
      check: ({ design }) => {
        const d = design.decisions;
        if (!d.counters) return { pass: false, detail: "Decide where counts live first." };
        if (d.counters === "local") return { pass: true, detail: "There's no counter store to lose." };
        const store = STORES.find((k) => design.edges.some(([a, b]) => (a === "limiter" && b === k) || (b === "limiter" && a === k)));
        if (!store) return { pass: false, detail: "The gateway isn't linked to a counter store." };
        const down = simulate(rateLimiterLab, design, { [store]: 0 });
        if (!down.flows.call.ok) return { pass: false, detail: down.flows.call.reason ?? "Calls stop." };
        return { pass: true, detail: d.counters === "sync" ? "Each gateway keeps its local counts until the store is back." : "Calls keep flowing, unlimited until the store is back: alert on it." };
      },
    },
    {
      id: "hot-partner",
      label: "The biggest partner can't overload one gateway",
      short: "Big partner",
      focus: ({ design }) => design.nodes.filter((n) => n.kind === "lb" || n.kind === "limiter").map((n) => n.kind),
      check: ({ design }) => {
        if (!design.decisions.routing) return { pass: false, detail: "Decide how the load balancer picks a gateway." };
        const n = design.nodes.find((x) => x.kind === "limiter")?.count ?? 0;
        if (!n) return { pass: false, detail: "There's no gateway yet." };
        const share = design.decisions.routing === "by-partner" ? Math.max(1 / n, BIGGEST) : 1 / n;
        const u = (CALLS * share) / catalog.limiter.capacity;
        return {
          pass: u < HEADROOM,
          detail: design.decisions.routing === "by-partner"
            ? `Routing by partner sends the chain's ${fmtRate(CALLS * BIGGEST)} to one gateway: ${Math.round(u * 100)}% of its capacity.`
            : `Round robin spreads every partner over ${n} gateways: the busiest runs at ${Math.round(u * 100)}%.`,
        };
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
      focus: ({ sim }) => pathsOf(sim, ["call"]),
      check: ({ sim, failures }) => {
        if (!sim.flows.call.ok) return { pass: false, detail: "Get calls through first." };
        const bad = failures.find((f) => !f.sim.flows.call.ok);
        return bad ? { pass: false, detail: `${bad.note} Then: ${bad.sim.flows.call.reason ?? ""}` } : { pass: true, detail: `Knocked out one machine of each of ${failures.length} components; calls kept flowing every time.` };
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
    ],
    edges: [["client", "app"], ["app", "sql"]],
    decisions: { counters: "local", routing: "round-robin", outage: "closed" },
  },
  wrong: [
    { name: "Local counts, spread round robin", design: { ...reference, edges: reference.edges.filter(([, b]) => b !== "cache"), nodes: reference.nodes.filter((n) => n.kind !== "cache"), decisions: { ...reference.decisions, counters: "local" } }, fails: "accurate" },
    { name: "Counters in the key-value store", design: swap({ ...reference, nodes: reference.nodes.filter((n) => n.kind !== "cache").map((n) => (n.kind === "kv" ? { ...n, count: 8 } : n)) }, "cache", "kv"), fails: "fast" },
    { name: "Fail closed", design: { ...reference, decisions: { ...reference.decisions, outage: "closed" } }, fails: "store-down" },
    { name: "Route each partner to one gateway", design: { ...reference, decisions: { ...reference.decisions, routing: "by-partner" } }, fails: "hot-partner" },
    { name: "No gateway in front of the API", design: { ...reference, nodes: reference.nodes.filter((n) => n.kind !== "limiter"), edges: [["client", "lb"], ["lb", "app"], ["app", "kv"]] }, fails: "enforced" },
  ],
  pinned: { cost: 2500, latencyMs: { call: 30.27 }, utilization: { lb: 0.3, limiter: 0.625, app: 0.6667, cache: 0.15, kv: 0.5 } },
  hints: [
    "Start from the 30,000 calls a second and the one partner sending 9,000 of them. Where can a count live so that every gateway agrees on it, and what does each choice cost per call?",
    "A shared in-memory counter (Redis-style) is exact and costs one sub-millisecond hop. Spread calls round robin so the big partner can't swamp one machine. Then decide what happens when the counter store is unreachable.",
    "Users → load balancer (2) → gateways (about 6) → API servers (about 15) → key-value store (3); gateways linked to a cache (2) for counts. Central counts, round robin, fail open. Then check the failure drill.",
  ],
  walkthrough: {
    summary:
      "Limits are per partner, but calls are spread across a fleet, so the count has to be shared, or kept close enough. A central in-memory counter is the simplest exact answer, at the cost of one sub-millisecond hop per call. Spread calls round robin so no partner can swamp a machine, and fail open, so a counter-store outage costs you limits for a while, not the whole API.",
    steps: [
      "Clarify: limits per partner per minute, enforced at a gateway before the API servers, with a 429 and Retry-After when exceeded.",
      "Numbers: 30,000 calls/s at peak, one partner at 9,000/s, 50,000 partners. Counter state is only about 5 MB, so memory isn't the problem; the round trip is.",
      "Counts: a token bucket per partner in Redis, updated atomically with a short script (read, refill, take) on every call. Two cache nodes, so one can fail.",
      "Routing: round robin across 6 gateways (8k calls/s each, about 63% at peak). Routing by partner would make local counts exact but put 9,000 calls/s on one machine.",
      "Failure: if Redis is unreachable, fail open and alert. With local counts synced every 100 ms you avoid the per-call hop and keep working through a store outage, at the cost of a little accuracy.",
    ],
    tradeoffs: [
      "Central counter: exact and simple, but one extra hop per call and a dependency on the store. Local + periodic sync: no hop and survives outages, but counts lag by the sync interval.",
      "Fail open keeps the API up but drops limits during an outage; fail closed protects downstream systems but turns a cache outage into an API outage.",
      "Consistent hashing by partner gives exact local counts, but load follows partner size; the biggest customer becomes a hot spot.",
      "Token bucket allows bursts up to the capacity; a sliding window is stricter but needs more state per partner.",
    ],
    followUps: [
      "Limits per endpoint as well as per partner.",
      "Multi-region: one global limit or one per region?",
      "Return remaining quota and Retry-After headers.",
      "Protect the system from an overloaded downstream service, not just from heavy partners (load shedding).",
    ],
  },
};
