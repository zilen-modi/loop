import { hotSpots, pathsOf, type DesignScenario } from "@/lib/design/evaluate";
import { catalog, type NodeKind } from "@/lib/design/catalog";
import { fmtRate, type Broken, type FlowDef, type Hop, type Route } from "@/lib/design/engine";
import type { Design, Graph } from "@/lib/design/graph";

const ONLINE = 2_000_000; // open connections at peak
const SENDS = 40_000; // messages sent per second at peak
const RECIPIENTS = 1.5; // mostly one-to-one, some small groups
const ONLINE_SHARE = 0.8; // recipients connected right now; the rest get a push notification
const HEARTBEAT_S = 30;
const HISTORY = 20_000; // scroll-back reads per second
const POLL_S = 2; // if clients poll instead
const CONNS_PER_GW = 100_000;
const DELIVER_MS = 100;
const HEADROOM = 0.7;
const BUDGET = 9500;

/** Requests over a client's socket: through the load balancers to the WebSocket gateways. */
function toGateway(g: Graph): { hops: Hop[] } | { broken: string } {
  if (!g.has("wsgw")) return { broken: "Chat needs open connections: add WebSocket gateways." };
  if (g.edge("client", "lb") && g.edge("lb", "wsgw")) return { hops: [{ kind: "lb" }, { kind: "wsgw" }] };
  if (g.edge("client", "wsgw")) {
    if (g.count("wsgw") > 1) return { broken: "Several gateways need a load balancer to spread new connections." };
    return { hops: [{ kind: "wsgw" }] };
  }
  return { broken: "Users can't connect. Link Users → Load balancer → WebSocket gateways." };
}

/** Ordinary HTTP calls (history): through the load balancers to the chat service. */
function toApp(g: Graph): { hops: Hop[] } | { broken: string } {
  if (g.edge("client", "lb") && g.edge("lb", "app")) return { hops: [{ kind: "lb" }, { kind: "app" }] };
  return { broken: "Users can't reach the chat service. Link Users → Load balancer → App servers." };
}

// Sending: over the socket to a gateway, then the chat service stores it.
const send: FlowDef = {
  id: "send",
  label: "Send",
  route: (g, t): Route | Broken => {
    const rate = t.sendsPerSec;
    const e = toGateway(g);
    if ("broken" in e) return { broken: e.broken };
    const hops = [...e.hops];
    if (!g.edge("wsgw", "app")) return { broken: "Gateways only hold connections: link them to the chat service (app servers).", rate, hops };
    hops.push({ kind: "app" });
    if (!g.edge("app", "kv")) return { broken: "Messages have nowhere to be stored: link the app servers to a message store (key-value).", rate, hops };
    hops.push({ kind: "kv", write: true });
    return { rate, hops };
  },
};

// Delivering to online recipients: how the chat service finds the right connection.
const deliver: FlowDef = {
  id: "deliver",
  label: "Deliver",
  route: (g, t): Route | Broken => {
    const how = g.decisions.delivery;
    if (!how) return { broken: "Decide how a message reaches the recipient's connection." };
    if (how === "poll") {
      const rate = (t.onlineConnections ?? ONLINE) / POLL_S;
      const e = toApp(g);
      if ("broken" in e) return { broken: e.broken };
      if (!g.edge("app", "kv")) return { broken: "Polling reads the message store: link the app servers to it.", rate, hops: e.hops };
      return { rate, hops: [...e.hops, { kind: "kv", from: "app" }] };
    }
    const rate = t.sendsPerSec;
    if (!g.edge("app", "wsgw")) return { broken: "The chat service can't reach the gateways: link them." };
    if (how === "broadcast") return { rate, hops: [{ kind: "wsgw", share: RECIPIENTS * g.count("wsgw"), from: "app" }] };
    if (!g.edge("app", "cache")) return { broken: "Finding a recipient's gateway needs a shared registry: link the app servers to a cache.", rate };
    return { rate, hops: [{ kind: "cache", share: RECIPIENTS, from: "app" }, { kind: "wsgw", share: RECIPIENTS * ONLINE_SHARE, from: "app" }] };
  },
};

// Recipients who are offline get a push notification, through a queue so a provider outage loses nothing.
const offline: FlowDef = {
  id: "offline",
  label: "Push to offline",
  route: (g, t): Route | Broken => {
    const rate = t.sendsPerSec * RECIPIENTS * (1 - ONLINE_SHARE);
    if (!g.edge("app", "queue")) return { broken: "Offline recipients need a push: link the app servers to a queue." };
    const hops: Hop[] = [{ kind: "queue", write: true, from: "app" }];
    if (!g.edge("queue", "worker")) return { broken: "Nothing sends the pushes: link the queue to workers.", rate, hops };
    hops.push({ kind: "worker" });
    if (!g.edge("worker", "provider")) return { broken: g.wired("worker", "provider") ? "The push provider is down; notifications wait in the queue." : "Workers need a push provider: link them to one.", rate, hops };
    hops.push({ kind: "provider" });
    return { rate, hops };
  },
};

// Presence: every connected client sends a heartbeat; where does "last seen" live?
const presence: FlowDef = {
  id: "presence",
  label: "Presence",
  route: (g, t): Route | Broken => {
    const rate = (t.onlineConnections ?? ONLINE) / HEARTBEAT_S;
    const e = toGateway(g);
    if ("broken" in e) return { broken: e.broken };
    const hops = [...e.hops];
    const where = g.decisions.presence;
    if (!where) return { broken: "Decide where presence lives.", rate, hops };
    if (where === "sql") {
      if (!g.edge("wsgw", "sql")) return { broken: "Heartbeats go to the database: link the gateways to the SQL primary.", rate, hops };
      hops.push({ kind: "sql", write: true });
      return { rate, hops };
    }
    if (!g.edge("wsgw", "cache")) return { broken: "Heartbeats refresh a key in the cache: link the gateways to it.", rate, hops };
    hops.push({ kind: "cache", write: true });
    return { rate, hops };
  },
};

// Scrolling back through a conversation.
const history: FlowDef = {
  id: "history",
  label: "History",
  route: (g, t): Route | Broken => {
    const rate = t.historyPerSec;
    const e = toApp(g);
    if ("broken" in e) return { broken: e.broken };
    if (!g.edge("app", "kv")) return { broken: "History is read from the message store: link the app servers to it.", rate, hops: e.hops };
    return { rate, hops: [...e.hops, { kind: "kv" }] };
  },
};

const reference: Design = {
  nodes: [
    { kind: "client", count: 1, x: 0, y: 0 },
    { kind: "lb", count: 4, x: 0, y: 0 },
    { kind: "wsgw", count: 29, x: 0, y: 0 },
    { kind: "app", count: 30, x: 0, y: 0 },
    { kind: "cache", count: 3, x: 0, y: 0 },
    { kind: "kv", count: 11, x: 0, y: 0 },
    { kind: "queue", count: 2, x: 0, y: 0 },
    { kind: "worker", count: 4, x: 0, y: 0 },
    { kind: "provider", count: 1, x: 0, y: 0 },
  ],
  edges: [
    ["client", "lb"],
    ["lb", "wsgw"],
    ["lb", "app"],
    ["wsgw", "app"],
    ["wsgw", "cache"],
    ["app", "cache"],
    ["app", "kv"],
    ["app", "queue"],
    ["queue", "worker"],
    ["worker", "provider"],
  ],
  decisions: { delivery: "registry", presence: "ttl", order: "seq" },
};

const core = ["send", "deliver", "offline", "presence", "history"];
const firstBroken = (s: { flows: Record<string, { ok: boolean; reason?: string }> }, ids = core) => ids.map((id) => s.flows[id]).find((f) => !f.ok);

export const chatLab: DesignScenario = {
  id: "chat",
  title: "Chat with your rider, live",
  statement: `Tiffin is adding chat: customers message their delivery rider, restaurants message their regulars, and friends plan group orders. A green dot shows who's online.

At dinner time, **2 million** people have the app open, each holding a live connection. Design the chat backend: how a message reaches the right connection, what happens when the recipient is offline, how presence works, and how messages stay in order. The simulator runs your design at peak, then knocks out one machine at a time.`,
  functional: [
    "Send a message to a person or a small group; online recipients see it immediately.",
    "Offline recipients get a push notification, and the message is there when they open the app.",
    "See who's online now, and scroll back through a conversation's history.",
  ],
  nonFunctional: [
    `A message reaches an online recipient in under ${DELIVER_MS} ms.`,
    "Messages in a conversation appear in the order they were sent, for everyone.",
    `2 million open connections, with every machine under ${HEADROOM * 100}% busy (connections included).`,
    "Losing any one machine doesn't stop chat; a push-provider outage only delays notifications.",
    `Under $${BUDGET.toLocaleString("en-US")} a month.`,
  ],
  estimates: [
    { label: "Open connections", value: "2,000,000", how: "Peak dinner time. A gateway holds about 100,000; at 70% that's 70,000 each, so about 29 gateways for connections alone." },
    { label: "Messages", value: "40,000 / s sent, 60,000 / s delivered", how: "1.5 recipients a message on average (mostly one-to-one); 80% are online right now, 20% need a push." },
    { label: "Heartbeats", value: "~67,000 / s", how: "2 million clients, one heartbeat every 30 seconds. Presence is the biggest write load in the system." },
    { label: "If clients polled", value: "1,000,000 reads / s", how: "2 million clients asking every 2 seconds, almost always for nothing, and still a second late on average." },
    { label: "Message store", value: "~3.5 TB a month", how: "40,000 a second × ~0.5 KB × 2.6 M seconds a month × 3 copies, partitioned by conversation." },
  ],
  traffic: { sendsPerSec: SENDS, historyPerSec: HISTORY, onlineConnections: ONLINE },
  flows: [send, deliver, offline, presence, history],
  metrics: [
    { flow: "send", label: "Send" },
    { flow: "deliver", label: "Deliver" },
  ],
  trafficLabel: (f) => `${fmtRate(SENDS * f)} messages, ${(ONLINE / 1e6).toFixed(0)}M connections`,
  decisions: [
    {
      id: "delivery",
      question: "How does a message reach the recipient's connection?",
      options: [
        { value: "registry", label: "Look up which gateway holds the recipient, and send it there", consequence: "Each gateway records its users in a shared registry (a cache). One lookup per recipient, one hop to the right gateway." },
        { value: "broadcast", label: "Send every message to every gateway; each checks its own users", consequence: "No registry to keep. But every gateway sees every message, so adding gateways adds work everywhere instead of spreading it." },
        { value: "poll", label: "Clients ask for new messages every 2 seconds", consequence: "No push at all. 2 million clients polling is a million reads a second, mostly empty, and messages arrive a second late on average." },
      ],
    },
    {
      id: "presence",
      question: "Where does presence (who's online) live?",
      options: [
        { value: "ttl", label: "A key per user in the cache, refreshed by each heartbeat, expiring after 60 s", consequence: "Cheap writes to memory. A user whose app dies simply expires; nobody has to notice the disconnect." },
        { value: "sql", label: "A last-seen column in the database, written on every heartbeat", consequence: "Durable, but it's ~67,000 writes a second of data nobody needs to keep." },
      ],
    },
    {
      id: "order",
      question: "How are messages in a conversation ordered?",
      options: [
        { value: "seq", label: "The chat service gives each message the conversation's next sequence number", consequence: "One order for everyone in the chat, decided in one place. Clients sort and spot gaps by number." },
        { value: "clock", label: "By the timestamp on the sender's phone", consequence: "Phone clocks drift by seconds or more, so a reply can appear above the question it answers." },
      ],
    },
  ],
  criteria: [
    {
      id: "send",
      label: "Messages are sent and stored",
      short: "Sending",
      focus: ({ sim }) => pathsOf(sim, ["send"]),
      check: ({ sim }) => {
        const f = sim.flows.send;
        return { pass: f.ok, detail: f.ok ? `Path: Users → ${f.path.map((k) => catalog[k].short).join(" → ")}` : f.reason ?? "" };
      },
    },
    {
      id: "deliver",
      label: `Online recipients get a message in under ${DELIVER_MS} ms`,
      short: `< ${DELIVER_MS} ms`,
      focus: ({ sim }) => pathsOf(sim, ["send", "deliver"]),
      check: ({ sim, design }) => {
        const s = sim.flows.send;
        const d = sim.flows.deliver;
        const how = design.decisions.delivery;
        if (how === "poll") return { pass: false, detail: `Polling every ${POLL_S} s: ${(Math.round(d.rate / 1000) * 1000).toLocaleString("en-US")} reads a second, almost all empty, and a message still waits ${((POLL_S / 2) * 1000).toLocaleString("en-US")} ms on average for the next poll.` };
        if (!d.ok && how === "broadcast") return { pass: false, detail: `Every gateway receives every message (${fmtRate(SENDS * RECIPIENTS)} each), however many gateways you add. ${d.reason ?? ""}` };
        if (!d.ok) return { pass: false, detail: d.reason ?? "" };
        if (!s.ok) return { pass: false, detail: "Sending doesn't work yet." };
        const ms = s.latencyMs + d.latencyMs;
        return { pass: ms <= DELIVER_MS, detail: `${Math.round(s.latencyMs)} ms to store, then ${Math.round(d.latencyMs)} ms to the recipient's gateway: ${Math.round(ms)} ms.` };
      },
    },
    {
      id: "offline",
      label: "Offline recipients get a push notification",
      short: "Offline push",
      focus: ({ sim }) => pathsOf(sim, ["offline"]),
      check: ({ sim }) => {
        const f = sim.flows.offline;
        return { pass: f.ok, detail: f.ok ? `${fmtRate(f.rate)} pushes through ${f.path.map((k) => catalog[k].short).join(" → ")}.` : f.reason ?? "" };
      },
    },
    {
      id: "presence",
      label: "Presence keeps up with every heartbeat",
      short: "Presence",
      focus: ({ sim }) => pathsOf(sim, ["presence"]),
      check: ({ sim }) => {
        const f = sim.flows.presence;
        return { pass: f.ok, detail: f.ok ? `${fmtRate(f.rate)} heartbeats along Users → ${f.path.map((k) => catalog[k].short).join(" → ")}.` : f.reason ?? "" };
      },
    },
    {
      id: "order",
      label: "Messages appear in the order they were sent",
      short: "In order",
      check: ({ design }) => {
        const o = design.decisions.order;
        if (!o) return { pass: false, detail: "Decide how messages are ordered." };
        if (o === "seq") return { pass: true, detail: "One sequence per conversation, assigned by the chat service: every member sees the same order, and a gap means a missed message to fetch." };
        return { pass: false, detail: "Senders' clocks disagree by seconds; a reply sent 1 s after a question from a phone running 3 s slow lands above it." };
      },
    },
    {
      id: "connections",
      label: `2 million connections, every gateway under ${HEADROOM * 100}% of its limit`,
      short: "Connections",
      focus: () => ["wsgw"],
      check: ({ design }) => {
        const n = design.nodes.find((x) => x.kind === "wsgw")?.count ?? 0;
        if (!n) return { pass: false, detail: "No WebSocket gateways to hold connections." };
        const each = ONLINE / n;
        return { pass: each <= CONNS_PER_GW * HEADROOM, detail: `${Math.round(each).toLocaleString("en-US")} connections per gateway, against a limit of about ${CONNS_PER_GW.toLocaleString("en-US")}. It takes ${Math.ceil(ONLINE / (CONNS_PER_GW * HEADROOM))} gateways to keep each under ${HEADROOM * 100}%.` };
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
      focus: ({ sim }) => pathsOf(sim, core),
      check: ({ sim, failures, design }) => {
        if (firstBroken(sim)) return { pass: false, detail: "Get sending, delivery, pushes, presence and history working first." };
        for (const f of failures) {
          const tolerated = f.kind === "provider" ? ["offline"] : [];
          const bad = firstBroken(f.sim, core.filter((id) => !tolerated.includes(id)));
          if (bad) return { pass: false, detail: `${f.note} Then: ${bad.reason ?? ""}` };
          if (f.kind === "wsgw") {
            const n = (design.nodes.find((x) => x.kind === "wsgw")?.count ?? 1) - 1;
            if (n * CONNS_PER_GW < ONLINE) return { pass: false, detail: `${f.note} The ${n} left can hold ${(n * CONNS_PER_GW).toLocaleString("en-US")} connections, fewer than 2 million.` };
          }
        }
        return { pass: true, detail: `Knocked out one machine of each of ${failures.length} components; chat kept working (a provider outage only queues pushes).` };
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
      { kind: "lb", count: 1, x: 0, y: 0 },
      { kind: "app", count: 4, x: 0, y: 0 },
      { kind: "sql", count: 1, x: 0, y: 0 },
    ],
    edges: [["client", "lb"], ["lb", "app"], ["app", "sql"]],
    decisions: { delivery: "poll", presence: "sql", order: "clock" },
  },
  wrong: [
    { name: "Broadcast every message to every gateway", design: { ...reference, decisions: { ...reference.decisions, delivery: "broadcast" } }, fails: "deliver" },
    { name: "Clients poll every 2 seconds", design: { ...reference, decisions: { ...reference.decisions, delivery: "poll" } }, fails: "deliver" },
    {
      name: "Presence in the database",
      design: { ...reference, nodes: [...reference.nodes, { kind: "sql", count: 1, x: 0, y: 0 }], edges: [...reference.edges, ["wsgw", "sql"]], decisions: { ...reference.decisions, presence: "sql" } },
      fails: "presence",
    },
    { name: "Order by the sender's clock", design: { ...reference, decisions: { ...reference.decisions, order: "clock" } }, fails: "order" },
    { name: "Just enough gateways for the connections", design: { ...reference, nodes: reference.nodes.map((n) => (n.kind === "wsgw" ? { ...n, count: 20 } : n)) }, fails: "connections" },
  ],
  pinned: { cost: 9260, latencyMs: { send: 34.2, deliver: 4.46, offline: 287.84, presence: 7.19, history: 31.48 }, utilization: { lb: 0.6333, wsgw: 0.2667, app: 0.6667, cache: 0.4222, kv: 0.6364, queue: 0.06, worker: 0.6, provider: 0.3 } },
  tolerates: { provider: { flows: ["offline"], why: "chat keeps working; push notifications wait in the queue until the provider is back." } },
  hints: [
    "Two kinds of traffic: long-lived connections that need somewhere to live, and messages that must find the one connection their recipient holds. Which machines hold connections, and how does a message find the right one?",
    "Gateways hold the sockets; a stateless chat service stores each message (in a store partitioned by conversation) and then needs to know which gateway each recipient is on: keep that in a shared registry. Presence is a key with an expiry, refreshed by heartbeats. Offline recipients go through a queue to a push provider.",
    "Users → load balancers (4) → WebSocket gateways (29, for connections) ↔ chat service (30 app servers) → message store (key-value, 11); a cache (3) holds the gateway registry and presence; app → queue (2) → workers (4) → push provider. Registry delivery, TTL presence, sequence numbers per conversation.",
  ],
  walkthrough: {
    summary:
      "Separate holding connections from handling messages. WebSocket gateways do nothing but hold sockets and pass frames; a stateless chat service stores each message with the conversation's next sequence number, then looks up which gateway each recipient is connected to (a registry in a cache that the gateways keep up to date) and hands the message to exactly that gateway. Recipients who aren't connected get a push through a queue, so a provider outage only delays them. Presence is a key per user that each heartbeat refreshes and that expires on its own.",
    steps: [
      "Requirements: one-to-one and small-group messages, delivered instantly online, pushed offline; presence; history; in order.",
      "Numbers: 2 M connections (29 gateways at 70%), 40,000 sends and 60,000 deliveries a second, ~67,000 heartbeats a second.",
      "Connect: the client opens a WebSocket through the load balancer to any gateway; the gateway writes user → gateway in the registry (with an expiry, refreshed by heartbeats).",
      "Send: gateway → chat service, which assigns the conversation's next sequence number and writes the message to the store (partitioned by conversation id, so one conversation is one partition).",
      "Deliver: look up each recipient in the registry; online → forward to their gateway, which pushes the frame; offline → enqueue a push notification.",
      "Read: on open, fetch messages after the last sequence number the client has; scroll-back pages by sequence number.",
    ],
    tradeoffs: [
      "A registry is one more thing to keep correct (stale entries after a crash), but it makes delivery one hop; broadcast to all gateways stops scaling the moment you add gateways.",
      "Sequence numbers per conversation give one order without synchronised clocks; global order across conversations isn't needed and would be a bottleneck.",
      "Presence in memory with expiry is approximate by design (up to 60 s stale), and that's fine for a green dot.",
      "Delivery is at least once: clients acknowledge by sequence number and de-duplicate, so a resend after a reconnect is harmless.",
    ],
    followUps: [
      "Read receipts and typing indicators: more small events over the same sockets, never stored for long.",
      "Large groups (10,000 members): fan out through a queue, and don't push presence for everyone.",
      "Multiple devices per user: the registry maps a user to several connections.",
      "End-to-end encryption: the server stores and forwards ciphertext; key exchange happens between devices.",
    ],
  },
};
