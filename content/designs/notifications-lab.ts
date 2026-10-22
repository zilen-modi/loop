import { hotSpots, pathsOf, type DesignScenario } from "@/lib/design/evaluate";
import { catalog, type NodeKind } from "@/lib/design/catalog";
import { fmtRate, simulate, type Broken, type FlowDef, type Hop, type Route } from "@/lib/design/engine";
import type { Design, Graph } from "@/lib/design/graph";

const RATE = 20_000; // notifications per second at peak
const ACCEPT_MS = 20;
const HEADROOM = 0.7;
const BUDGET = 3000;
const QUEUES: NodeKind[] = ["queue", "stream"];
const PREFS: NodeKind[] = ["kv", "replica", "sql"];

/** Services → (LB) → notification API. */
function entry(g: Graph): { hops: Hop[] } | { broken: string } {
  if (g.edge("client", "lb") && g.edge("lb", "app")) return { hops: [{ kind: "lb" }, { kind: "app" }] };
  if (g.edge("client", "app")) {
    if (g.count("app") > 1) return { broken: "Several API servers need a load balancer in front of them." };
    return { hops: [{ kind: "app" }] };
  }
  return { broken: "Tiffin's services can't reach the notification API. Connect Users → Load balancer → App servers." };
}

const queued = (g: Graph) => g.decisions.delivery === "queue";

// Accepting a request: the part other services wait for.
const accept: FlowDef = {
  id: "accept",
  label: "Accept",
  route: (g, t): Route | Broken => {
    const rate = t.notificationsPerSec;
    const e = entry(g);
    if ("broken" in e) return { broken: e.broken };
    const hops = [...e.hops];
    if (queued(g)) {
      const q = g.firstLinked(["app"], QUEUES);
      if (!q) return { broken: "Queued delivery needs the API servers linked to a queue.", rate, hops };
      hops.push({ kind: q, write: true, from: "app" });
      return { rate, hops };
    }
    // Direct: the API looks up preferences and calls the provider while the caller waits.
    const prefs = g.firstLinked(["app"], PREFS);
    if (prefs) hops.push({ kind: prefs, from: "app" });
    if (!g.wired("app", "provider")) return { broken: "Notifications go nowhere: queue them, or link the API servers to the provider.", rate, hops };
    if (!g.has("provider")) return { broken: "The provider is down and the API calls it directly: every request fails.", rate, hops };
    hops.push({ kind: "provider", write: true, from: "app" });
    return { rate, hops };
  },
};

// Delivering it: workers take messages off the queue, check preferences and duplicates, and send.
const deliver: FlowDef = {
  id: "deliver",
  label: "Deliver",
  route: (g, t): Route | Broken => {
    const rate = t.notificationsPerSec;
    if (!queued(g)) return { rate: 0, hops: [] }; // delivered inline by accept
    const q = g.firstLinked(["app"], QUEUES);
    if (!q) return { broken: "There's no queue to deliver from." };
    if (!g.edge(q, "worker")) return { broken: "Nothing reads the queue: link it to workers." };
    const hops: Hop[] = [{ kind: q, from: "app" }, { kind: "worker", from: q }];
    const prefs = g.firstLinked(["worker"], PREFS);
    if (prefs) hops.push({ kind: prefs, from: "worker" });
    if (g.decisions.dedup === "key" && g.edge("worker", "cache")) hops.push({ kind: "cache", write: true, from: "worker" });
    if (!g.wired("worker", "provider")) return { broken: "Workers aren't linked to the provider.", rate, hops };
    if (!g.has("provider")) return { broken: "The provider is down: messages wait in the queue.", rate, hops };
    hops.push({ kind: "provider", write: true, from: "worker" });
    return { rate, hops };
  },
};

const sendPath = (s: { flows: Record<string, { path: NodeKind[] }> }, design: Design) => (design.decisions.delivery === "queue" ? s.flows.deliver.path : s.flows.accept.path);

const reference: Design = {
  nodes: [
    { kind: "client", count: 1, x: 0, y: 0 },
    { kind: "lb", count: 2, x: 0, y: 0 },
    { kind: "app", count: 12, x: 0, y: 0 },
    { kind: "queue", count: 2, x: 0, y: 0 },
    { kind: "worker", count: 6, x: 0, y: 0 },
    { kind: "kv", count: 3, x: 0, y: 0 },
    { kind: "cache", count: 2, x: 0, y: 0 },
    { kind: "provider", count: 1, x: 0, y: 0 },
  ],
  edges: [
    ["client", "lb"],
    ["lb", "app"],
    ["app", "queue"],
    ["queue", "worker"],
    ["worker", "kv"],
    ["worker", "cache"],
    ["worker", "provider"],
  ],
  decisions: { delivery: "queue", retries: "backoff", dedup: "key" },
};

export const notificationsLab: DesignScenario = {
  id: "notification-system",
  title: "Order updates, without losing one",
  statement: `Every Tiffin order sends push notifications: "accepted", "rider assigned", "arriving in 2 minutes". Ordering, payments and support all call one internal notification API, and at dinner peak it handles **20,000 notifications a second**. A third-party push provider does the last mile. It's fast most of the time, sometimes slow, and once a month or so it goes down for a few minutes.

Design the notification system. Choose how deliveries happen, how failures are retried, and how duplicates are prevented. The simulator runs your design at peak, takes the provider down, then knocks out one of your machines at a time.`,
  functional: [
    "Services send a notification (customer, template, data) and get an immediate acknowledgement.",
    "Each notification is delivered once, unless the customer has turned that kind off.",
    "Failed sends are retried; ones that keep failing are set aside for inspection (a dead-letter queue).",
  ],
  nonFunctional: [
    `Accepting a notification takes under ${ACCEPT_MS} ms at peak, so callers never wait on the provider.`,
    "A provider outage loses nothing and doesn't slow the API; messages go out when it's back.",
    "A retry never notifies a customer twice.",
    `Losing any one machine doesn't stop accepting or delivering; every machine stays under ${HEADROOM * 100}% busy.`,
    `Under $${BUDGET.toLocaleString("en-US")} a month (provider fees are billed separately).`,
  ],
  estimates: [
    { label: "Peak sends", value: "20,000 / s", how: "60,000 orders an hour at peak × ~6 updates each, bunched at mealtimes: about 2,000 / s on average, 10× at the busiest minutes." },
    { label: "Provider time", value: "≈ 200 ms per send", how: "A network call to a third party. 20,000 / s × 0.2 s = 4,000 sends in flight at any moment." },
    { label: "Provider outage", value: "5 minutes = 6 M messages", how: "20,000 / s × 300 s. That backlog has to wait somewhere durable, then drain without a stampede." },
    { label: "Preferences", value: "≈ 40 M customers", how: "One small record each (which kinds they want, quiet hours): read on every send, rarely written." },
    { label: "Dedup window", value: "≈ 24 h of message ids", how: "Retries happen within minutes; keeping ids for a day is generous. 20,000 / s × 86,400 s × 16 bytes ≈ 28 GB, or far less with a shorter window." },
  ],
  traffic: { notificationsPerSec: RATE },
  flows: [accept, deliver],
  metrics: [
    { flow: "accept", label: "Accept" },
    { flow: "deliver", label: "Deliver" },
  ],
  trafficLabel: (f) => `${fmtRate(RATE * f)} notifications`,
  decisions: [
    {
      id: "delivery",
      question: "How does a notification reach the provider?",
      options: [
        { value: "direct", label: "The API calls the provider while the caller waits", consequence: "Simple, with nothing extra to run. But every caller waits ~200 ms for a third party, and when the provider is slow or down, so is everything that sends notifications." },
        { value: "queue", label: "The API puts it on a queue; workers send it", consequence: "The API answers in milliseconds and the queue absorbs bursts and outages. More parts to run, and a notification is delivered a moment later." },
      ],
    },
    {
      id: "retries",
      question: "When a send fails, what happens?",
      options: [
        { value: "none", label: "Log it and move on", consequence: "Every failure is a lost notification: during an outage, millions." },
        { value: "immediate", label: "Retry straight away until it works", consequence: "Fine for a one-off blip. In an outage, every worker hammers the provider in a tight loop, new messages queue up behind the retries, and the provider has even less chance of recovering." },
        { value: "backoff", label: "Retry with exponential backoff and jitter; dead-letter after 8 tries", consequence: "Waits 1 s, 2 s, 4 s… plus randomness, so retries spread out. Messages that never succeed go to a dead-letter queue instead of looping forever." },
      ],
    },
    {
      id: "dedup",
      question: "How do you avoid sending twice?",
      options: [
        { value: "none", label: "Don't worry about it", consequence: "Queues deliver at least once, and a send that timed out may still have reached the phone. Some customers get every update twice." },
        { value: "key", label: "An idempotency key per notification, checked before sending", consequence: "Each notification gets an id; workers record it in a fast store before sending and skip ids already sent. One extra write per send." },
      ],
    },
  ],
  criteria: [
    {
      id: "accepts",
      label: "Notifications are accepted",
      short: "Accepted",
      focus: ({ sim }) => pathsOf(sim, ["accept"]),
      check: ({ sim }) => {
        const f = sim.flows.accept;
        return { pass: f.ok, detail: f.ok ? `Path: Services → ${f.path.map((k) => catalog[k].short).join(" → ")}` : f.reason ?? "" };
      },
    },
    {
      id: "fast-accept",
      label: `Accepting takes under ${ACCEPT_MS} ms at peak`,
      short: `< ${ACCEPT_MS} ms`,
      focus: ({ sim }) => pathsOf(sim, ["accept"]),
      check: ({ sim }) => {
        const f = sim.flows.accept;
        if (!f.ok) return { pass: false, detail: "Notifications aren't accepted yet." };
        return { pass: f.latencyMs <= ACCEPT_MS, detail: `${Math.round(f.latencyMs)} ms along ${f.path.map((k) => catalog[k].short).join(" → ")}.${f.path.includes("provider") ? " Callers are waiting on the provider." : ""}` };
      },
    },
    {
      id: "delivers",
      label: "Deliveries keep up at peak",
      short: "Delivered",
      focus: ({ sim, design }) => sendPath(sim, design),
      check: ({ sim, design }) => {
        const f = design.decisions.delivery === "queue" ? sim.flows.deliver : sim.flows.accept;
        if (!design.decisions.delivery) return { pass: false, detail: "Decide how notifications reach the provider." };
        if (!f.ok) return { pass: false, detail: f.reason ?? "Notifications aren't delivered." };
        return { pass: f.path.includes("provider"), detail: f.path.includes("provider") ? `${fmtRate(RATE)} sends reach the provider.` : "Nothing reaches the provider." };
      },
    },
    {
      id: "preferences",
      label: "Customers who opted out aren't notified",
      short: "Preferences",
      focus: ({ sim, design }) => sendPath(sim, design),
      check: ({ sim, design }) => {
        const f = design.decisions.delivery === "queue" ? sim.flows.deliver : sim.flows.accept;
        if (!f.ok) return { pass: false, detail: "Notifications aren't being sent yet, so nothing to check." };
        const path = sendPath(sim, design);
        const store = path.find((k) => PREFS.includes(k));
        return { pass: !!store, detail: store ? `Preferences are checked in the ${catalog[store].label.toLowerCase()} before each send.` : "Nothing checks preferences before sending. Link whoever sends to a store of customer preferences." };
      },
    },
    {
      id: "once",
      label: "A retry never notifies a customer twice",
      short: "No duplicates",
      focus: ({ design }) => design.nodes.filter((n) => ["worker", "cache"].includes(n.kind)).map((n) => n.kind),
      check: ({ sim, design }) => {
        if (design.decisions.dedup !== "key") return { pass: false, detail: "Without an idempotency key, a retried or redelivered message is sent again." };
        if (design.decisions.delivery !== "queue") return { pass: false, detail: "With direct calls, a caller that times out and retries sends twice; there's nowhere to check the key." };
        if (!sim.flows.deliver.ok) return { pass: false, detail: "Notifications aren't being sent yet." };
        const ok = sim.flows.deliver.path.includes("cache");
        return { pass: ok, detail: ok ? "Workers record each notification's id in the cache and skip ids already sent." : "The key needs somewhere fast to live: link the workers to a cache." };
      },
    },
    {
      id: "outage",
      label: "A provider outage loses nothing and doesn't slow the API",
      short: "Provider outage",
      focus: ({ design }) => design.nodes.filter((n) => ["app", "queue", "stream", "worker", "provider"].includes(n.kind)).map((n) => n.kind),
      check: ({ design }) => {
        const down = simulate(notificationsLab, design, { provider: 0 });
        if (!down.flows.accept.ok) return { pass: false, detail: down.flows.accept.reason ?? "The API stops accepting." };
        if (design.decisions.delivery !== "queue") return { pass: false, detail: "Without a queue there's nowhere for messages to wait." };
        if (design.decisions.retries === "backoff") return { pass: true, detail: "The API keeps accepting; messages wait in the queue and retries back off, then drain when the provider returns. Hopeless ones go to the dead-letter queue." };
        if (design.decisions.retries === "immediate") return { pass: false, detail: "Workers retry in a tight loop: the queue fills with retries, fresh notifications wait behind them, and the provider gets hammered as it tries to recover." };
        return { pass: false, detail: "Failed sends are dropped: a five-minute outage loses about 6 million notifications." };
      },
    },
    {
      id: "failures",
      label: "Survives losing any one machine",
      short: "Failures",
      focus: ({ sim }) => pathsOf(sim, ["accept", "deliver"]),
      check: ({ sim, failures }) => {
        const works = (x: typeof sim) => x.flows.accept.ok && x.flows.deliver.ok;
        if (!works(sim)) return { pass: false, detail: "Get accepting and delivering working first." };
        const ours = failures.filter((f) => !catalog[f.kind].external);
        const bad = ours.find((f) => !works(f.sim));
        if (!bad) return { pass: true, detail: `Knocked out one machine of each of ${ours.length} components; nothing stopped.` };
        return { pass: false, detail: `${bad.note} Then: ${(!bad.sim.flows.accept.ok ? bad.sim.flows.accept.reason : bad.sim.flows.deliver.reason) ?? ""}` };
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
      id: "cost",
      label: `Under $${BUDGET.toLocaleString("en-US")} a month`,
      short: "Budget",
      check: ({ sim }) => ({ pass: sim.costPerMonth <= BUDGET, detail: `$${sim.costPerMonth.toLocaleString("en-US")} a month.` }),
    },
  ],
  start: { nodes: [{ kind: "client", count: 1, x: 0, y: 200 }, { kind: "provider", count: 1, x: 900, y: 200 }], edges: [], decisions: {} },
  reference,
  naive: {
    nodes: [
      { kind: "client", count: 1, x: 0, y: 0 },
      { kind: "app", count: 1, x: 0, y: 0 },
      { kind: "provider", count: 1, x: 0, y: 0 },
    ],
    edges: [["client", "app"], ["app", "provider"]],
    decisions: { delivery: "direct", retries: "immediate", dedup: "none" },
  },
  wrong: [
    {
      name: "Call the provider straight from the API",
      design: {
        ...reference,
        nodes: reference.nodes.filter((n) => !["queue", "worker"].includes(n.kind)).map((n) => (n.kind === "app" ? { ...n, count: 40 } : n)),
        edges: [["client", "lb"], ["lb", "app"], ["app", "kv"], ["app", "cache"], ["app", "provider"]],
        decisions: { ...reference.decisions, delivery: "direct" },
      },
      fails: "fast-accept",
    },
    { name: "Retry immediately", design: { ...reference, decisions: { ...reference.decisions, retries: "immediate" } }, fails: "outage" },
    { name: "No duplicate check", design: { ...reference, decisions: { ...reference.decisions, dedup: "none" } }, fails: "once" },
    { name: "Workers don't check preferences", design: { ...reference, nodes: reference.nodes.filter((n) => n.kind !== "kv"), edges: reference.edges.filter(([, b]) => b !== "kv") }, fails: "preferences" },
    { name: "Too few workers", design: { ...reference, nodes: reference.nodes.map((n) => (n.kind === "worker" ? { ...n, count: 3 } : n)) }, fails: "delivers" },
  ],
  tolerates: { provider: { flows: ["deliver"], why: "the API keeps accepting, and deliveries wait in the queue until the provider is back." } },
  pinned: { cost: 2430, latencyMs: { accept: 15, deliver: 411.11 }, utilization: { lb: 0.2, app: 0.5556, queue: 0.2, worker: 0.6667, kv: 0.3333, cache: 0.1, provider: 0.5 } },
  hints: [
    "Callers need an answer in milliseconds, but the provider takes 200 ms and sometimes disappears. What can sit between them so neither waits for the other?",
    "A durable queue between the API and a pool of workers decouples them. Then think about failure: how retries behave during an outage, where hopeless messages go, and how a retried message avoids being sent twice.",
    "Services → load balancer (2) → API servers (about 12) → queue (2) → workers (about 6) → provider, with workers reading preferences from a key-value store (3) and recording idempotency keys in a cache (2). Queue, backoff with a dead-letter queue, idempotency keys.",
  ],
  walkthrough: {
    summary:
      "Separate accepting from delivering. The API validates, writes the notification to a durable queue and answers within milliseconds. Workers drain the queue, check preferences and an idempotency key, then call the provider. Failures are retried with backoff and jitter, and dead-lettered after a few tries. A provider outage becomes a growing queue instead of an outage of everything that sends notifications.",
    steps: [
      "Requirements: an internal API, delivery at least once and shown once, preferences respected, retries, a dead-letter queue.",
      "Numbers: 20,000 sends/s at peak; 200 ms per provider call means about 4,000 in flight; a 5-minute outage backs up about 6 M messages, which have to wait somewhere durable.",
      "Accept: load balancer → API servers → queue. The API stores the message and returns its id; ~15 ms at peak.",
      "Deliver: workers (5k sends/s each, 6 for headroom) read the queue, look up preferences, record the idempotency key (skip if seen), send, and acknowledge the queue message only after a successful send.",
      "Failure: exponential backoff with jitter; after 8 tries, a dead-letter queue with an alert. Duplicates from at-least-once delivery are stopped by the key.",
    ],
    tradeoffs: [
      "A queue adds a hop and a little delivery delay, but turns provider slowness and outages into backlog instead of errors.",
      "At-least-once delivery plus an idempotency key gives effectively-once notifications; true exactly-once across a third party isn't possible.",
      "Backoff protects the provider during recovery, but delays individual messages. Use priority queues so an OTP isn't stuck behind 6 million promotions.",
      "The dedup store needs only a window (hours, not forever) and can lose data occasionally; it's a cache, not a database.",
    ],
    followUps: [
      "Several channels (push, SMS, email) with different providers and limits.",
      "Priorities: OTPs before order updates before promotions.",
      "Quiet hours and per-customer rate limits (no more than N promos a day).",
      "Track delivery status and show it to support agents.",
    ],
  },
};
