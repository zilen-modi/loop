import { hotSpots, pathsOf, type DesignScenario } from "@/lib/design/evaluate";
import { catalog, type NodeKind } from "@/lib/design/catalog";
import { fmtRate, type Broken, type FlowDef, type Hop, type Route } from "@/lib/design/engine";
import type { Design, Graph } from "@/lib/design/graph";

const READS = 50_000; // feed loads per second at peak
const POSTS = 2_000; // new posts per second at peak
const FOLLOWERS = 200; // average followers per author
const FOLLOWS = 300; // accounts an average user follows
const CELEBS = 5; // celebrities an average user follows
const CELEB_FOLLOWERS = 20_000_000;
const BATCH = 100; // feed inserts per fan-out message
const USERS = 40_000_000;
const ENTRIES = 200; // feed entries kept per user
const NODE_GB = 64; // memory per cache node
const FEED_MS = 100;
const FRESH_S = 5;
const HEADROOM = 0.7;
const BUDGET = 6000;

function entry(g: Graph): { hops: Hop[] } | { broken: string } {
  if (g.edge("client", "lb") && g.edge("lb", "app")) return { hops: [{ kind: "lb" }, { kind: "app" }] };
  if (g.edge("client", "app")) {
    if (g.count("app") > 1) return { broken: "Several app servers need a load balancer in front of them." };
    return { hops: [{ kind: "app" }] };
  }
  return { broken: "Users can't reach the app. Connect Users → Load balancer → App servers." };
}

const strategy = (g: Graph) => g.decisions.strategy;

// Loading a feed: the precomputed list (or every followee's posts, when pulling), then the posts themselves.
const read: FlowDef = {
  id: "read",
  label: "Load feed",
  route: (g, t): Route | Broken => {
    const rate = t.readsPerSec;
    const e = entry(g);
    if ("broken" in e) return { broken: e.broken };
    const hops = [...e.hops];
    const src: NodeKind | null = g.edge("app", "cache") ? "cache" : g.edge("app", "kv") ? "kv" : null;
    if (!src) return { broken: "Feeds have nowhere to come from: link the app servers to a feed cache.", rate, hops };
    const share = strategy(g) === "pull" ? FOLLOWS : strategy(g) === "hybrid" ? 1 + CELEBS : 1;
    hops.push({ kind: src, share, from: "app" });
    if (g.decisions.entries !== "copies") {
      if (!g.edge("app", "kv")) return { broken: "Feed entries are post ids: the app needs the posts store to fetch the posts.", rate, hops };
      hops.push({ kind: "kv", from: "app" }); // one batched multi-get per page of posts
    }
    return { rate, hops };
  },
};

// Posting: save the post, and (unless pulling) queue the fan-out.
const post: FlowDef = {
  id: "post",
  label: "Post",
  route: (g, t): Route | Broken => {
    const rate = t.postsPerSec;
    const e = entry(g);
    if ("broken" in e) return { broken: e.broken };
    const hops: Hop[] = e.hops.map((h) => ({ ...h, write: true }));
    if (!g.edge("app", "kv")) return { broken: "Posts have nowhere to be saved: link the app servers to a posts store (key-value).", rate, hops };
    hops.push({ kind: "kv", write: true, from: "app" });
    if (strategy(g) === "push" || strategy(g) === "hybrid") {
      if (!g.edge("app", "queue")) return { broken: "Fan-out needs a queue: link the app servers to one.", rate, hops };
      hops.push({ kind: "queue", write: true, from: "app" });
    }
    return { rate, hops };
  },
};

// Fan-out: workers insert each new post's id into every follower's feed.
const fanout: FlowDef = {
  id: "fanout",
  label: "Fan-out",
  route: (g, t): Route | Broken => {
    const rate = t.postsPerSec;
    if (strategy(g) !== "push" && strategy(g) !== "hybrid") return { rate: 0, hops: [] };
    if (!g.edge("queue", "worker")) return { broken: "Nothing does the fan-out: link the queue to workers." };
    if (!g.edge("worker", "cache")) return { broken: "Workers have nowhere to write feeds: link them to the feed cache." };
    return {
      rate,
      hops: [
        { kind: "queue", from: "app" },
        { kind: "worker", share: FOLLOWERS / BATCH, from: "queue" },
        { kind: "cache", share: FOLLOWERS, write: true, from: "worker" },
      ],
    };
  },
};

const reference: Design = {
  nodes: [
    { kind: "client", count: 1, x: 0, y: 0 },
    { kind: "lb", count: 3, x: 0, y: 0 },
    { kind: "app", count: 26, x: 0, y: 0 },
    { kind: "queue", count: 2, x: 0, y: 0 },
    { kind: "worker", count: 2, x: 0, y: 0 },
    { kind: "cache", count: 11, x: 0, y: 0 },
    { kind: "kv", count: 5, x: 0, y: 0 },
  ],
  edges: [
    ["client", "lb"],
    ["lb", "app"],
    ["app", "cache"],
    ["app", "kv"],
    ["app", "queue"],
    ["queue", "worker"],
    ["worker", "cache"],
  ],
  decisions: { strategy: "hybrid", entries: "ids" },
};

const count = (d: Design, k: NodeKind) => d.nodes.find((n) => n.kind === k)?.count ?? 0;

export const newsFeedLab: DesignScenario = {
  id: "news-feed",
  title: "The food feed, with a celebrity chef",
  statement: `Tiffin is launching a feed: people follow restaurants, home chefs and friends, and see their dish photos and offers in one scrolling list. Most accounts have a few hundred followers. One celebrity chef has **20 million**, and posts several times a day.

Design the feed. Choose when the work happens (when someone posts, or when someone reads) and what a feed entry holds. The simulator runs your design at peak, checks how a celebrity post spreads, and knocks out one machine at a time.`,
  functional: [
    "Users post (text, photo links, offers).",
    "Users load their feed: the newest posts from everyone they follow, newest first, a page at a time.",
    "A new post appears in followers' feeds within seconds.",
  ],
  nonFunctional: [
    `A feed page loads in under ${FEED_MS} ms at peak.`,
    `New posts reach followers' feeds within ${FRESH_S} seconds, even right after the celebrity posts.`,
    "The feed cache fits in memory.",
    `Losing any one machine doesn't stop reading or posting; every machine stays under ${HEADROOM * 100}% busy.`,
    `Under $${BUDGET.toLocaleString("en-US")} a month.`,
  ],
  estimates: [
    { label: "Feed loads", value: "50,000 / s", how: "40 M users, ~10 loads a day each, bunched around meals: about 5,000 / s on average, 10× at peak." },
    { label: "New posts", value: "2,000 / s", how: "Far fewer than reads: most people scroll, a few post." },
    { label: "Fan-out on write", value: "400,000 inserts / s", how: "2,000 posts × 200 followers each. Batched 100 per message, that's 4,000 messages a second for workers." },
    { label: "Fan-out on read", value: "15 M lookups / s", how: "50,000 loads × 300 accounts followed. Merging that many timelines on every load is the problem." },
    { label: "One celebrity post", value: "20 M inserts", how: "Pushed to every follower's feed at once, it swamps the cache and queues everyone else's posts behind it." },
    { label: "Feed memory", value: "64 GB of ids, or 8 TB of copies", how: "40 M users × 200 entries × 8-byte ids = 64 GB. Copying ~1 KB posts instead is 125× more. Cache nodes hold 64 GB each." },
  ],
  traffic: { readsPerSec: READS, postsPerSec: POSTS },
  flows: [read, post, fanout],
  metrics: [
    { flow: "read", label: "Load feed" },
    { flow: "post", label: "Post" },
  ],
  trafficLabel: (f) => `${fmtRate(READS * f)} feed loads, ${fmtRate(POSTS * f)} posts`,
  decisions: [
    {
      id: "strategy",
      question: "When is a feed assembled?",
      options: [
        { value: "pull", label: "On read: merge the latest posts of everyone you follow", consequence: "Posting is cheap and always fresh. But every feed load reads ~300 timelines and merges them: 15 million lookups a second at peak." },
        { value: "push", label: "On write: push each new post into every follower's feed", consequence: "Loading a feed is one cheap read of a precomputed list. But each post costs one insert per follower, and a celebrity post costs 20 million." },
        { value: "hybrid", label: "Push for most authors; pull for celebrities", consequence: "Normal posts are pushed. Celebrities' posts aren't; each reader merges in the few celebrities they follow at load time (~5 extra reads). This is what large feeds do." },
      ],
    },
    {
      id: "entries",
      question: "What does a feed entry hold?",
      options: [
        { value: "ids", label: "Just the post id; fetch posts when the feed loads", consequence: "Small: 8 bytes an entry. Edits and deletes show up everywhere at once. One batched fetch per page." },
        { value: "copies", label: "A full copy of the post", consequence: "No fetch on read, but ~1 KB an entry, copied for every follower, and an edit has to be pushed to millions of copies." },
      ],
    },
  ],
  criteria: [
    {
      id: "reads",
      label: "Feeds load",
      short: "Feeds load",
      focus: ({ sim }) => pathsOf(sim, ["read"]),
      check: ({ sim }) => {
        const f = sim.flows.read;
        return { pass: f.ok, detail: f.ok ? `Path: Users → ${f.path.map((k) => catalog[k].short).join(" → ")}` : f.reason ?? "" };
      },
    },
    {
      id: "fast",
      label: `A feed page loads in under ${FEED_MS} ms at peak`,
      short: `< ${FEED_MS} ms`,
      focus: ({ sim }) => pathsOf(sim, ["read"]),
      check: ({ sim }) => {
        const f = sim.flows.read;
        if (!f.ok) return { pass: false, detail: "Feeds don't load yet." };
        return { pass: f.latencyMs <= FEED_MS, detail: `${Math.round(f.latencyMs)} ms along ${f.path.map((k) => catalog[k].short).join(" → ")}.` };
      },
    },
    {
      id: "posts",
      label: "Posts are saved",
      short: "Posting",
      focus: ({ sim }) => pathsOf(sim, ["post"]),
      check: ({ sim }) => {
        const f = sim.flows.post;
        return { pass: f.ok, detail: f.ok ? `Path: Users → ${f.path.map((k) => catalog[k].short).join(" → ")}` : f.reason ?? "" };
      },
    },
    {
      id: "fresh",
      label: `New posts reach feeds within ${FRESH_S} s, even after a celebrity posts`,
      short: "Fresh feeds",
      focus: ({ design }) => design.nodes.filter((n) => ["queue", "worker", "cache"].includes(n.kind)).map((n) => n.kind),
      check: ({ design, sim }) => {
        const s = design.decisions.strategy;
        if (!s) return { pass: false, detail: "Decide when feeds are assembled." };
        if (s === "pull") return { pass: true, detail: "Posts are read when feeds load, so they're always fresh (if loading keeps up)." };
        if (!sim.flows.fanout.ok) return { pass: false, detail: sim.flows.fanout.reason ?? "Fan-out isn't working yet." };
        if (s === "hybrid") return { pass: true, detail: "Celebrities aren't fanned out: their followers pull them in on load, so a huge post holds up nobody." };
        const spare = count(design, "cache") * catalog.cache.capacity - (sim.load.cache?.load ?? 0);
        const workers = count(design, "worker") * catalog.worker.capacity;
        const secs = Math.max(CELEB_FOLLOWERS / Math.max(1, spare), CELEB_FOLLOWERS / BATCH / Math.max(1, workers));
        return {
          pass: secs <= FRESH_S,
          detail: `One celebrity post means ${CELEB_FOLLOWERS / 1e6} million feed inserts: about ${Math.round(secs)} s of spare cache and worker capacity, while everyone else's posts wait behind it.`,
        };
      },
    },
    {
      id: "memory",
      label: "The feed cache fits in memory",
      short: "Memory",
      focus: ({ design }) => design.nodes.filter((n) => n.kind === "cache").map((n) => n.kind),
      check: ({ design }) => {
        if (!design.decisions.entries) return { pass: false, detail: "Decide what a feed entry holds." };
        const gb = (USERS * ENTRIES * (design.decisions.entries === "ids" ? 8 : 1000)) / 1e9;
        const need = Math.ceil(gb / NODE_GB);
        const have = count(design, "cache");
        return { pass: have >= need, detail: `${gb >= 1000 ? `${(gb / 1000).toFixed(0)} TB` : `${Math.round(gb)} GB`} of feeds needs at least ${need} cache node${need > 1 ? "s" : ""} of ${NODE_GB} GB; you have ${have}.` };
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
      focus: ({ sim }) => pathsOf(sim, ["read", "post", "fanout"]),
      check: ({ sim, failures }) => {
        const works = (x: typeof sim) => x.flows.read.ok && x.flows.post.ok && x.flows.fanout.ok;
        if (!works(sim)) return { pass: false, detail: "Get loading, posting and fan-out working first." };
        const bad = failures.find((f) => !works(f.sim));
        if (!bad) return { pass: true, detail: `Knocked out one machine of each of ${failures.length} components; nothing stopped.` };
        const why = [bad.sim.flows.read, bad.sim.flows.post, bad.sim.flows.fanout].find((f) => !f.ok)?.reason ?? "";
        return { pass: false, detail: `${bad.note} Then: ${why}` };
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
    decisions: { strategy: "pull", entries: "copies" },
  },
  wrong: [
    { name: "Fan-out on read for everyone", design: { ...reference, decisions: { ...reference.decisions, strategy: "pull" } }, fails: "reads" },
    { name: "Fan-out on write for everyone", design: { ...reference, decisions: { ...reference.decisions, strategy: "push" } }, fails: "fresh" },
    { name: "Copy whole posts into feeds", design: { ...reference, decisions: { ...reference.decisions, entries: "copies" } }, fails: "memory" },
    { name: "Too few feed-cache nodes", design: { ...reference, nodes: reference.nodes.map((n) => (n.kind === "cache" ? { ...n, count: 8 } : n)) }, fails: "headroom" },
  ],
  pinned: { cost: 5080, latencyMs: { read: 30.64, post: 29.94, fanout: 4.79 }, utilization: { lb: 0.3467, app: 0.6667, queue: 0.02, worker: 0.4, cache: 0.6364, kv: 0.56 } },
  hints: [
    "Compare the two jobs: 50,000 feed loads a second against 2,000 posts. Which side should do the expensive work, and what's the one account that breaks that answer?",
    "Fan-out on write makes loading cheap, but a 20-million-follower post is 20 million inserts. Fan-out on read makes posting cheap, but every load merges hundreds of timelines. Treat celebrities differently from everyone else, and store ids rather than copies.",
    "Users → load balancers (3, because at 52,000 requests a second one survivor out of two would be overloaded) → app servers (about 26) → feed cache (about 11) and posts store (key-value, 5); posts also go to a queue (2) → workers (2) → feed cache. Hybrid fan-out, ids in feeds.",
  ],
  walkthrough: {
    summary:
      "Reads outnumber posts 25 to 1, so do the work at write time and make a feed load one read of a precomputed list. That breaks for one account in a million: the celebrity whose post would be 20 million inserts. So go hybrid: push posts from normal authors into followers' feeds, and let readers pull in the handful of celebrities they follow at load time. Feeds hold post ids, not copies, so they fit in memory and edits show everywhere.",
    steps: [
      "Requirements: post, load a paged feed (newest first), new posts visible within seconds.",
      "Numbers: 50,000 loads/s and 2,000 posts/s at peak; 400,000 feed inserts/s if pushed; 15 M lookups/s if pulled; one celebrity post = 20 M inserts; feeds of ids = 64 GB.",
      "Write path: save the post in a key-value store, enqueue a fan-out job; workers insert the id into each follower's feed list in the cache, in batches of 100.",
      "Celebrities (above ~100k followers) are skipped by fan-out. On load, the app reads the user's feed list plus the latest posts of the ~5 celebrities they follow, merges, and fetches post bodies for the page in one batched read.",
      "Capacity: 11 cache nodes for 700k ops/s at 64%; 26 app servers; 5 key-value nodes. Feeds survive losing a cache node, and can be rebuilt from the posts store if lost.",
    ],
    tradeoffs: [
      "Push makes reads cheap and posting expensive; pull is the reverse. Hybrid pays a little on both, with a threshold to tune.",
      "Ids in feeds need a fetch on read (batched), but cost 125× less memory than copies, and edits and deletes don't have to be pushed to millions of feeds.",
      "Feeds in a cache can be rebuilt from the posts store; that makes the cache a performance layer, not the source of truth.",
      "Ranking (not just newest first) changes the read path: candidates from the feed list, scored by a model. Mention it, and keep it out of the core design.",
    ],
    followUps: [
      "Ranked feeds instead of newest first.",
      "Inactive users: don't fan out to people who haven't opened the app in a month; rebuild on their return.",
      "Deleting a post, or blocking an account.",
      "Paging: cursors based on post time or id, not offsets.",
    ],
  },
};
