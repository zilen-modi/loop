import { hotSpots, pathsOf, type DesignScenario } from "@/lib/design/evaluate";
import { catalog, type NodeKind } from "@/lib/design/catalog";
import { fmtRate, type Broken, type FlowDef, type Hop, type Route } from "@/lib/design/engine";
import type { Design, Graph } from "@/lib/design/graph";

const BROWSE = 100_000; // event-page loads per second as the sale opens
const ARRIVALS = 30_000; // fans pressing "Book" per second in the first minutes
const POLLS = 60_000; // waiting fans checking their place: 600,000 in line, every 10 s
const ADMIT = 1_000; // fans the waiting room lets through per second
const CONFIRMS = 800; // holds paid for per second (about 1 in 5 is abandoned)
const RETRY = 3; // with no line, a refused fan retries: each one becomes ~3 attempts
const ORIGIN = 0.001; // share of page loads the CDN passes on: it refreshes the seat counts every second
const SEATS = 80_000;
const ABANDONED = 0.2;
const PAGE_MS = 100;
const HEADROOM = 0.7;
const BUDGET = 3000;

/** Fans' booking requests: through the gateways if they're in front, then load balancers and app servers. */
function toApp(g: Graph, mustQueue: boolean): { hops: Hop[] } | { broken: string } {
  const hops: Hop[] = [];
  let front: NodeKind = "client";
  if (g.edge("client", "limiter")) {
    hops.push({ kind: "limiter" });
    front = "limiter";
  } else if (mustQueue) return { broken: "A waiting room needs gateways in front: link Users → Rate-limit gateway → Load balancer." };
  if (g.edge(front, "lb") && g.edge("lb", "app")) return { hops: [...hops, { kind: "lb" }, { kind: "app" }] };
  if (g.edge(front, "app")) {
    if (g.count("app") > 1) return { broken: "Several app servers need a load balancer in front of them." };
    return { hops: [...hops, { kind: "app" }] };
  }
  return { broken: "Fans can't reach the booking servers. Connect them through a load balancer to app servers." };
}

const room = (g: Graph) => g.decisions.admission === "room";

// The event page and live seat counts: from the CDN if there is one, otherwise from the app.
const browse: FlowDef = {
  id: "browse",
  label: "Event page",
  route: (g, t): Route | Broken => {
    const rate = t.browsePerSec;
    const counts: NodeKind | null = g.edge("app", "cache") ? "cache" : g.edge("app", "sql") ? "sql" : null;
    if (g.edge("client", "cdn")) {
      const hops: Hop[] = [{ kind: "cdn" }];
      if (!g.edge("cdn", "lb") || !g.edge("lb", "app") || !counts) return { broken: "The CDN needs an origin for the seat counts: link CDN → Load balancer → App servers → a store.", rate, hops };
      hops.push({ kind: "lb", share: ORIGIN, onPath: false, from: "cdn" }, { kind: "app", share: ORIGIN, onPath: false, from: "lb" }, { kind: counts, share: ORIGIN, onPath: false, from: "app" });
      return { rate, hops };
    }
    if (!g.edge("client", "lb") && !g.edge("client", "app")) return { broken: "Fans can't load the event page. Put a CDN in front, or connect Users → Load balancer → App servers." };
    const e = g.edge("client", "lb") && g.edge("lb", "app") ? { hops: [{ kind: "lb" }, { kind: "app" }] as Hop[] } : g.count("app") > 1 ? null : { hops: [{ kind: "app" }] as Hop[] };
    if (!e) return { broken: "Several app servers need a load balancer in front of them." };
    if (!counts) return { broken: "The page needs seat counts: link the app servers to a cache or the database.", rate, hops: e.hops };
    return { rate, hops: [...e.hops, { kind: counts, from: "app" }] };
  },
};

// Joining the waiting room and checking your place: the gateways answer, from one shared line in the cache.
const queue: FlowDef = {
  id: "queue",
  label: "Waiting room",
  route: (g, t): Route | Broken => {
    if (!room(g)) return { rate: 0, hops: [] };
    const rate = t.arrivalsPerSec + t.pollsPerSec;
    if (!g.edge("client", "limiter")) return { broken: "A waiting room needs gateways in front: link Users → Rate-limit gateway." };
    const hops: Hop[] = [{ kind: "limiter" }];
    if (!g.edge("limiter", "cache")) {
      if (g.wired("limiter", "cache")) return { broken: "The cache holding the line is down: nobody can join it or check their place.", rate, hops };
      return { broken: "The gateways need one shared line: link them to a cache that hands out places in order.", rate, hops };
    }
    hops.push({ kind: "cache", write: true });
    return { rate, hops };
  },
};

// Holding seats: admitted fans only, or every attempt (with retries) if there's no line.
const hold: FlowDef = {
  id: "hold",
  label: "Hold seats",
  route: (g, t): Route | Broken => {
    const rate = room(g) ? Math.min(t.arrivalsPerSec, ADMIT) : t.arrivalsPerSec * RETRY;
    const e = toApp(g, room(g));
    if ("broken" in e) return { broken: e.broken };
    const hops = [...e.hops];
    const seats = g.decisions.seats;
    if (!seats) return { broken: "Decide how a seat is taken.", rate, hops };
    if (seats === "lock") {
      if (!g.edge("app", "cache")) return { broken: "Seat locks live in the cache: link the app servers to one.", rate, hops };
      hops.push({ kind: "cache", write: true, from: "app" });
      return { rate, hops };
    }
    if (!g.edge("app", "sql")) return { broken: "Seats live in the database: link the app servers to the SQL primary.", rate, hops };
    if (seats === "check") hops.push({ kind: "sql", from: "app" });
    hops.push({ kind: "sql", write: true, from: "app" });
    return { rate, hops };
  },
};

// Paying: the hold becomes a booking row in the database (and a lock, if any, is released).
const confirm: FlowDef = {
  id: "confirm",
  label: "Pay and confirm",
  route: (g, t): Route | Broken => {
    const rate = t.confirmsPerSec;
    const e = toApp(g, false);
    if ("broken" in e) return { broken: e.broken };
    const hops = [...e.hops];
    if (!g.edge("app", "sql")) return { broken: "Bookings are records you can't lose: link the app servers to the SQL primary.", rate, hops };
    hops.push({ kind: "sql", write: true, from: "app" });
    if (g.decisions.seats === "lock" && g.edge("app", "cache")) hops.push({ kind: "cache", write: true, onPath: false, from: "app" });
    return { rate, hops };
  },
};

const reference: Design = {
  nodes: [
    { kind: "client", count: 1, x: 0, y: 0 },
    { kind: "cdn", count: 1, x: 0, y: 0 },
    { kind: "limiter", count: 17, x: 0, y: 0 },
    { kind: "lb", count: 2, x: 0, y: 0 },
    { kind: "app", count: 2, x: 0, y: 0 },
    { kind: "cache", count: 2, x: 0, y: 0 },
    { kind: "sql", count: 1, x: 0, y: 0 },
    { kind: "replica", count: 1, x: 0, y: 0 },
  ],
  edges: [
    ["client", "cdn"],
    ["client", "limiter"],
    ["cdn", "lb"],
    ["limiter", "lb"],
    ["limiter", "cache"],
    ["lb", "app"],
    ["app", "cache"],
    ["app", "sql"],
    ["sql", "replica"],
  ],
  decisions: { admission: "room", seats: "sql", expiry: "ttl" },
};

const flowsOk = (s: { flows: Record<string, { ok: boolean; reason?: string }> }) => ["browse", "queue", "hold", "confirm"].map((id) => s.flows[id]).find((f) => !f.ok);

export const ticketBookingLab: DesignScenario = {
  id: "ticket-booking",
  title: "Tiffin Fest: 80,000 passes, a million fans",
  statement: `Tiffin is running a food festival, and passes go on sale at 10:00 on Saturday. There are **80,000** of them. About a million people will be on the page when the sale opens, and most will press "Book" within the first minute.

Design the booking system. Every pass must be sold exactly once, fans should be served roughly in the order they arrived, and the system has to stay up while the crowd hits it. The simulator runs your design at the moment the sale opens, then knocks out one machine at a time.

In this lab, the **Rate-limit gateway** box can also run a waiting room: it gives each fan a place in line and lets only a fixed number through each second.`,
  functional: [
    "Fans see the event page with live seat counts.",
    "Fans hold seats for 10 minutes while they pay; the hold becomes a booking when payment succeeds.",
    "When demand is higher than the system can serve, fans wait in a line and are let in in order.",
  ],
  nonFunctional: [
    "No seat is ever sold twice.",
    `The event page loads in under ${PAGE_MS} ms for a million fans.`,
    "Seats from abandoned holds come back for someone else.",
    `Losing any one machine doesn't stop the sale; every machine stays under ${HEADROOM * 100}% busy.`,
    `Under $${BUDGET.toLocaleString("en-US")} a month.`,
  ],
  estimates: [
    { label: "Event-page loads", value: "100,000 / s", how: "A million fans refreshing about every 10 seconds as the sale opens. The page is the same for everyone, so a CDN can serve it." },
    { label: "Booking attempts", value: "30,000 / s", how: "Most of the million press Book in the first half-minute. With no line, refused fans retry: about 3 attempts each, 90,000 / s." },
    { label: "What the seat store can take", value: "3,000 writes / s", how: "One SQL primary. Each hold is one conditional update, so at most ~1,000 holds a second leaves room for payments." },
    { label: "Waiting-room checks", value: "90,000 / s", how: "30,000 joins plus 600,000 people in line checking their place every 10 s. Each check is one counter read at a gateway: cheap." },
    { label: "Time to sell out", value: "under a minute", how: "80,000 passes, 2 per order: 40,000 orders at 1,000 holds a second is 40 s. 1 hold in 5 lapses and is sold again, so about 50 s." },
  ],
  traffic: { browsePerSec: BROWSE, arrivalsPerSec: ARRIVALS, pollsPerSec: POLLS, confirmsPerSec: CONFIRMS },
  flows: [hold, browse, queue, confirm],
  metrics: [
    { flow: "hold", label: "Hold seats" },
    { flow: "browse", label: "Event page" },
  ],
  trafficLabel: (f) => `${fmtRate(BROWSE * f)} page loads, ${fmtRate(ARRIVALS * f)} fans booking`,
  decisions: [
    {
      id: "admission",
      question: "What happens when a million fans press Book at once?",
      options: [
        { value: "open", label: "Let everyone through; first request to arrive wins", consequence: "Every attempt reaches the app and the seat store. Refused fans retry, so 30,000 fans become ~90,000 attempts a second, and bots that retry fastest win." },
        { value: "room", label: "A waiting room: hand out places in line, admit 1,000 a second", consequence: "The crowd talks to the gateways and a counter in the cache, which is cheap. The booking path sees a steady 1,000 holds a second, in arrival order." },
      ],
    },
    {
      id: "seats",
      question: "How does a hold take a seat?",
      options: [
        { value: "check", label: "Read whether the seats are free, then write the hold", consequence: "Two steps. Two fans can both read 'free' before either writes, and both get the seat." },
        { value: "sql", label: "One conditional update in the database", consequence: "UPDATE … WHERE seat is free; it either changes every row or none. Atomic, and the database is the single source of truth, but every hold is a write on the primary." },
        { value: "lock", label: "A lock per seat in the cache (SET NX with an expiry), booking written on payment", consequence: "Very fast, and the expiry doubles as the hold. But the lock and the booking live in different places: keep a unique constraint on (event, seat) in the database as the last guard." },
      ],
    },
    {
      id: "expiry",
      question: "What happens to a hold nobody pays for?",
      options: [
        { value: "ttl", label: "It expires after 10 minutes", consequence: "Seats come back by themselves; computed from the hold's expiry time, so there's no timer per hold." },
        { value: "manual", label: "It stays until the fan cancels", consequence: "About 1 in 5 holds is abandoned. Those seats are gone for good." },
      ],
    },
  ],
  criteria: [
    {
      id: "browse",
      label: `The event page loads in under ${PAGE_MS} ms`,
      short: "Event page",
      focus: ({ sim }) => pathsOf(sim, ["browse"]),
      check: ({ sim }) => {
        const f = sim.flows.browse;
        if (!f.ok) return { pass: false, detail: f.reason ?? "" };
        return { pass: f.latencyMs <= PAGE_MS, detail: `${Math.round(f.latencyMs)} ms along Users → ${f.path.map((k) => catalog[k].short).join(" → ")}.` };
      },
    },
    {
      id: "holds",
      label: "Fans can hold seats at peak",
      short: "Holds",
      focus: ({ sim }) => pathsOf(sim, ["queue", "hold"]),
      check: ({ sim }) => {
        const bad = [sim.flows.queue, sim.flows.hold].find((f) => !f.ok);
        if (bad) return { pass: false, detail: bad.reason ?? "" };
        return { pass: true, detail: `${fmtRate(sim.flows.hold.rate)} holds along Users → ${sim.flows.hold.path.map((k) => catalog[k].short).join(" → ")}, ${Math.round(sim.flows.hold.latencyMs)} ms each.` };
      },
    },
    {
      id: "confirm",
      label: "Paid holds become bookings",
      short: "Bookings",
      focus: ({ sim }) => pathsOf(sim, ["confirm"]),
      check: ({ sim }) => {
        const f = sim.flows.confirm;
        return { pass: f.ok, detail: f.ok ? `Path: Users → ${f.path.map((k) => catalog[k].short).join(" → ")}` : f.reason ?? "" };
      },
    },
    {
      id: "once",
      label: "No seat is ever sold twice",
      short: "Sold once",
      focus: ({ design }) => design.nodes.filter((n) => ["sql", "cache"].includes(n.kind)).map((n) => n.kind),
      check: ({ design }) => {
        const s = design.decisions.seats;
        if (!s) return { pass: false, detail: "Decide how a hold takes a seat." };
        if (s === "check") return { pass: false, detail: "Read, then write: at 1,000 holds a second, two fans often read 'free' for the same seat in the same few milliseconds, and both are sold it." };
        if (s === "sql") return { pass: true, detail: "One conditional update: it changes every requested seat or none, so the second fan's update finds the seat taken." };
        return { pass: true, detail: "SET NX takes a seat for exactly one fan; the database's unique constraint on (event, seat) catches anything a failed cache node lets through." };
      },
    },
    {
      id: "fair",
      label: "Fans are let in in the order they arrived",
      short: "Fair",
      focus: ({ design }) => design.nodes.filter((n) => ["limiter", "cache"].includes(n.kind)).map((n) => n.kind),
      check: ({ design, sim }) => {
        if (design.decisions.admission !== "room") return { pass: false, detail: `With no line, whoever's retry lands first wins: a bot retrying 50 times a second beats a fan who clicks once. And every attempt costs the booking path: ${fmtRate(sim.flows.hold.rate)}.` };
        if (!sim.flows.queue.ok) return { pass: false, detail: sim.flows.queue.reason ?? "" };
        return { pass: true, detail: `Each fan gets a place from one shared counter; the gateways admit ${ADMIT.toLocaleString("en-US")} a second, in order.` };
      },
    },
    {
      id: "return",
      label: "Seats from abandoned holds come back",
      short: "Holds expire",
      check: ({ design }) => {
        if (!design.decisions.expiry) return { pass: false, detail: "Decide what happens to a hold nobody pays for." };
        if (design.decisions.expiry === "ttl") return { pass: true, detail: "Holds end 10 minutes after they start; a seat is free if its hold has expired, so abandoned seats are sold again." };
        return { pass: false, detail: `About ${ABANDONED * 100}% of holds are never paid for: ${(SEATS * ABANDONED).toLocaleString("en-US")} of ${SEATS.toLocaleString("en-US")} passes would be stuck, unsold, while the festival shows "sold out".` };
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
      focus: ({ sim }) => pathsOf(sim, ["browse", "queue", "hold", "confirm"]),
      check: ({ sim, failures }) => {
        if (flowsOk(sim)) return { pass: false, detail: "Get the page, the line, holds and bookings working first." };
        const bad = failures.find((f) => flowsOk(f.sim));
        if (!bad) return { pass: true, detail: `Knocked out one machine of each of ${failures.length} components; the sale kept going.` };
        return { pass: false, detail: `${bad.note} Then: ${flowsOk(bad.sim)?.reason ?? ""}` };
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
    decisions: { admission: "open", seats: "check", expiry: "manual" },
  },
  wrong: [
    { name: "Open doors, no waiting room", design: { ...reference, decisions: { ...reference.decisions, admission: "open" } }, fails: "fair" },
    { name: "Check if free, then book", design: { ...reference, decisions: { ...reference.decisions, seats: "check" } }, fails: "once" },
    { name: "Holds that never expire", design: { ...reference, decisions: { ...reference.decisions, expiry: "manual" } }, fails: "return" },
    {
      name: "No CDN: the app serves the event page",
      design: { ...reference, nodes: reference.nodes.filter((n) => n.kind !== "cdn"), edges: [...reference.edges.filter(([a, b]) => a !== "cdn" && b !== "cdn"), ["client", "lb"]] },
      fails: "browse",
    },
    { name: "One cache node for the line", design: { ...reference, nodes: reference.nodes.map((n) => (n.kind === "cache" ? { ...n, count: 1 } : n)) }, fails: "failures" },
  ],
  pinned: { cost: 2400, latencyMs: { hold: 48.91, browse: 8.89, queue: 4.9, confirm: 48.91 }, utilization: { cdn: 0.1, limiter: 0.675, lb: 0.019, app: 0.3167, cache: 0.4505, sql: 0.6 } },
  hints: [
    "Separate the crowd from the sale. A million people want to look and to queue; only about a thousand a second can actually be served by the one database that knows which seats are free. Which parts of the traffic can be answered somewhere cheap?",
    "The event page is the same for everyone: serve it from a CDN. The line can be a counter in a cache, answered by gateways in front of everything else. Behind them, take seats with one atomic step, and let holds expire on their own.",
    "Users → CDN (the page) and Users → gateways (17, with the waiting room) → load balancers (2) → app servers (2) → SQL primary with a replica; the gateways and app servers share a cache (2 nodes) for the line. Admit 1,000 a second; one conditional update per hold; 10-minute expiry.",
  ],
  walkthrough: {
    summary:
      "The hard part isn't the booking itself (about a thousand holds a second is easy for one database) but the crowd around it. So shape the traffic: the identical event page comes from a CDN; the million people who press Book get a place in a virtual waiting room, run by cheap gateways and a counter in a cache; and only a steady 1,000 a second reach the booking path, in the order they arrived. Behind that, a hold is one atomic conditional update in the database, so a seat can't be sold twice, and it expires after ten minutes, so abandoned seats return.",
    steps: [
      "Requirements: browse with live counts, hold for 10 minutes then pay, a fair line when demand exceeds capacity, never sell a seat twice.",
      "Numbers: 100,000 page loads/s, 30,000 booking attempts/s (90,000 with retries), 600,000 people in line; one SQL primary takes 3,000 writes/s.",
      "Page: a CDN serves the event page and a seat-count snapshot refreshed every second; the origin sees about 100 requests a second.",
      "Line: gateways hand each arriving fan a number from one shared counter (Redis INCR) and a signed token; fans poll their place; the gateways admit 1,000 a second by number.",
      "Hold: UPDATE seats SET hold = h, hold_until = now + 10 min WHERE id IN (…) AND (hold IS NULL OR hold_until < now) AND booking IS NULL, and check that every row changed. Pay: write the booking in the same database.",
      "Capacity: 17 gateways at 68%, 2 cache nodes at 45%, the SQL primary at 60% with a replica to promote; $2,400 a month.",
    ],
    tradeoffs: [
      "A waiting room adds a wait for everyone, but it's fair and it protects the database. Without one, the fastest retries (often bots) win, and the database falls over.",
      "Holds in the database are atomic and simple; locks in a cache are faster but split the truth across two systems, so the database still needs a unique constraint.",
      "Seat counts on the page are a second old. That's fine: the hold is the moment of truth, and it's exact.",
      "The admission rate is a dial. Set it from what the booking path can take with headroom, and raise it as you add capacity.",
    ],
    followUps: [
      "Bots: limits per account and per card, CAPTCHA at the front of the line, tokens bound to the session.",
      "Payment callbacks that arrive after a hold expired: refund automatically, or extend holds once while a payment is pending.",
      "Choosing seats on a map, not just a count: lock rows of seats per section and shard the seat table by section.",
      "Many events on sale at once: one line per event, and shard the seat data by event.",
    ],
  },
};
