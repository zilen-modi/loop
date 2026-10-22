import { hotSpots, type DesignScenario } from "@/lib/design/evaluate";
import { catalog, fmtLatency, type Design } from "@/lib/design/sim";

const LATENCY_MS = 50;
const HEADROOM = 0.7;
const BUDGET = 4000;

const reference: Design = {
  nodes: [
    { kind: "client", count: 1, x: 0, y: 200 },
    { kind: "lb", count: 2, x: 170, y: 200 },
    { kind: "app", count: 12, x: 340, y: 200 },
    { kind: "cache", count: 2, x: 540, y: 70 },
    { kind: "kv", count: 3, x: 540, y: 230 },
    { kind: "idgen", count: 2, x: 340, y: 380 },
    { kind: "queue", count: 2, x: 540, y: 390 },
    { kind: "worker", count: 8, x: 720, y: 390 },
    { kind: "analytics", count: 1, x: 900, y: 390 },
  ],
  edges: [
    ["client", "lb"],
    ["lb", "app"],
    ["app", "cache"],
    ["app", "kv"],
    ["app", "idgen"],
    ["app", "queue"],
    ["queue", "worker"],
    ["worker", "analytics"],
  ],
  decisions: { ids: "counter", redirect: "302", analytics: "async" },
};

export const urlShortener: DesignScenario = {
  id: "url-shortener",
  title: "Short links for Tiffin's notifications",
  statement: `Tiffin sends millions of SMS and push messages: order tracking, refunds, weekend promos. Long URLs eat SMS characters, so the growth team wants short links like \`tfn.in/aZ3kQ9x\`, and marketing wants to know how many people tap each one.

Design the service on the canvas. Add components from the palette, link them, set how many machines each one runs on, and make the three design decisions. The simulator runs your design at **peak traffic** and checks it against the requirements. Then it knocks out one machine at a time.`,
  functional: [
    "Create a short link for a long URL. The code is 7 characters.",
    "Opening a short link redirects to the long URL.",
    "Count every click on every link, for the marketing dashboard. A few seconds' delay is fine.",
  ],
  nonFunctional: [
    `A redirect takes under ${LATENCY_MS} ms inside our network at peak, even when the link isn't cached.`,
    "Losing any one machine must not stop redirects or link creation.",
    "Two links must never get the same code.",
    `Every machine stays under ${HEADROOM * 100}% busy at peak, so there's room for a surprise.`,
    `The whole thing costs under $${BUDGET.toLocaleString("en-US")} a month.`,
  ],
  estimates: [
    { label: "New links", value: "400 / s at peak", how: "100 M a month ÷ 2.6 M seconds ≈ 40 / s on average. Promo blasts go out all at once: plan for 10× that." },
    { label: "Redirects", value: "20,000 / s at peak", how: "About 50 clicks for each link created: 40 × 50 = 2,000 / s on average, 10× at peak." },
    { label: "Storage", value: "≈ 3 TB over 5 years", how: "100 M × 12 × 5 = 6 B links × ~500 bytes each. Too big to keep comfortably on one database machine forever, small for a partitioned store." },
    { label: "Code space", value: "62⁷ ≈ 3.5 trillion", how: "7 characters of a–z, A–Z, 0–9. Over 500× the 6 B links we'll ever make." },
    { label: "Cache hit rate", value: "≈ 90%", how: "Clicks cluster on the latest campaigns: about 20% of links get 90% of clicks, and that 20% fits in memory." },
  ],
  traffic: { readsPerSec: 20_000, writesPerSec: 400, cacheHitRate: 0.9, cdnHitRate: 0.6 },
  decisions: [
    {
      id: "ids",
      question: "How are short codes made?",
      options: [
        { value: "hash", label: "First 7 characters of a hash of the long URL", consequence: "Two different URLs can share the same first 7 characters, and you'd only find out when a click lands on the wrong page. The same URL used in two campaigns also gets one code, so their click counts merge." },
        { value: "random", label: "7 random characters, checked before saving", consequence: "Collisions are rare but possible, so every create first looks the code up: one extra database read per new link. Codes aren't guessable." },
        { value: "counter", label: "A counter, encoded in base 62", consequence: "No collisions and no lookups. Each app server takes a block of 1,000 numbers at a time from a small ID service, so the ID service is rarely called. Codes are sequential and so guessable; scramble the bits if that matters." },
      ],
    },
    {
      id: "redirect",
      question: "Which redirect status do you send?",
      options: [
        { value: "301", label: "301 Moved Permanently", consequence: "Browsers and the CDN remember the redirect, so repeat clicks never reach your servers. Cheaper and faster, but you can't count those clicks or ever change where the link points." },
        { value: "302", label: "302 Found (temporary)", consequence: "Every click reaches your servers (a CDN can't answer it for you), so every click can be counted and links can be edited later. Costs more server capacity." },
      ],
    },
    {
      id: "analytics",
      question: "How are clicks recorded?",
      options: [
        { value: "sync", label: "Write the click before sending the redirect", consequence: "Simple. But every redirect now waits for the analytics write, and if the analytics store is slow or down, so are redirects." },
        { value: "async", label: "Put the click on a queue; workers record it", consequence: "The redirect returns straight away. Workers write clicks in batches; counts lag by a few seconds. Needs a queue and some workers." },
      ],
    },
  ],
  criteria: [
    {
      id: "reads",
      label: "Redirects work",
      check: ({ sim }) => ({ pass: sim.read.ok, detail: sim.read.ok ? `Path: Users → ${sim.read.path.map((k) => catalog[k].short).join(" → ")}` : sim.read.reason ?? "" }),
    },
    {
      id: "writes",
      label: "New links can be created",
      check: ({ design, sim }) =>
        !design.decisions.ids
          ? { pass: false, detail: "Decide how short codes are made." }
          : { pass: sim.write.ok, detail: sim.write.ok ? `Path: Users → ${sim.write.path.map((k) => catalog[k].short).join(" → ")}` : sim.write.reason ?? "" },
    },
    {
      id: "unique",
      label: "Codes never collide",
      check: ({ design }) => {
        const v = design.decisions.ids;
        if (!v) return { pass: false, detail: "Decide how short codes are made." };
        if (v === "hash") return { pass: false, detail: "Truncated hashes collide, and nothing checks for it." };
        return { pass: true, detail: v === "counter" ? "Every counter value is used once." : "Each random code is checked before it's saved." };
      },
    },
    {
      id: "clicks",
      label: "Every click is counted",
      check: ({ design, sim }) => {
        if (!design.decisions.redirect || !design.decisions.analytics) return { pass: false, detail: "Decide the redirect status and how clicks are recorded." };
        if (design.decisions.redirect === "301") return { pass: false, detail: "With 301, browsers and the CDN answer repeat clicks themselves, so you never see them." };
        return { pass: sim.analytics.ok, detail: sim.analytics.ok ? "Every click reaches the analytics store." : sim.analytics.reason ?? "" };
      },
    },
    {
      id: "latency",
      label: `Redirect under ${LATENCY_MS} ms at peak, on a cache miss`,
      check: ({ sim }) =>
        !sim.read.ok
          ? { pass: false, detail: "Redirects don't work yet." }
          : { pass: sim.read.latencyMs <= LATENCY_MS, detail: `${fmtLatency(sim.read.latencyMs)} along ${sim.read.path.map((k) => catalog[k].short).join(" → ")}. Busy machines are slower: a machine at 80% takes 5× its base time.` },
    },
    {
      id: "headroom",
      label: `Every machine under ${HEADROOM * 100}% at peak`,
      check: ({ sim }) => {
        const hot = hotSpots(sim, HEADROOM);
        return { pass: hot.length === 0, detail: hot.length ? `Too busy: ${hot.join(", ")}.` : sim.bottleneck ? `Busiest: ${catalog[sim.bottleneck.kind].label} at ${Math.round(sim.bottleneck.utilization * 100)}%.` : "" };
      },
    },
    {
      id: "failures",
      label: "Survives losing any one machine",
      check: ({ sim, failures }) => {
        if (!sim.read.ok || !sim.write.ok) return { pass: false, detail: "Get redirects and link creation working first." };
        const bad = failures.find((f) => !f.sim.read.ok || !f.sim.write.ok);
        if (!bad) return { pass: true, detail: `Knocked out one machine of each of ${failures.length} components; redirects and new links kept working every time.` };
        return { pass: false, detail: `${bad.note} Then: ${(!bad.sim.read.ok ? bad.sim.read.reason : bad.sim.write.reason) ?? ""}` };
      },
    },
    {
      id: "cost",
      label: `Under $${BUDGET.toLocaleString("en-US")} a month`,
      check: ({ sim }) => ({ pass: sim.costPerMonth <= BUDGET, detail: `$${sim.costPerMonth.toLocaleString("en-US")} a month.` }),
    },
  ],
  start: { nodes: [{ kind: "client", count: 1, x: 0, y: 200 }], edges: [], decisions: {} },
  reference,
  naive: {
    nodes: [
      { kind: "client", count: 1, x: 0, y: 200 },
      { kind: "app", count: 1, x: 200, y: 200 },
      { kind: "sql", count: 1, x: 400, y: 200 },
      { kind: "analytics", count: 1, x: 400, y: 360 },
    ],
    edges: [["client", "app"], ["app", "sql"], ["app", "analytics"]],
    decisions: { ids: "hash", redirect: "301", analytics: "sync" },
  },
  hints: [
    "Start from the numbers: 20,000 redirects a second at peak, but only 400 new links. It's a read-heavy system, so most of the design is about making a redirect cheap.",
    "Run several app servers behind a load balancer, put a cache in front of the database for the hot links, and take click counting off the redirect path. Then think about what happens when each box has only one machine.",
    "Users → load balancer (2) → app servers (about 12) → cache (2) and a database. Choose counter IDs (with an ID service), 302 redirects and async analytics (queue → workers → analytics store). Run the failure drill and add a second machine wherever one failure stops everything.",
  ],
  walkthrough: {
    summary:
      "The redirect path is the product: make it short and keep everything else off it. Writes are rare, so link creation can afford an extra hop to an ID service, while clicks are recorded asynchronously.",
    steps: [
      "Requirements and numbers first: 400 creates and 20,000 redirects per second at peak; 3 TB over five years. The 50:1 read ratio decides the whole design.",
      "API: POST /links {url} → {code}; GET /{code} → 302 to the long URL. Data: code → {url, createdAt, owner}. A single key lookup, so a partitioned key-value store fits (SQL with read replicas works too).",
      "Codes: a counter encoded in base 62. App servers lease blocks of numbers from an ID service, so there are no collisions and no lookups. Run two ID services so a failure doesn't stop link creation.",
      "Reads: load balancer → stateless app servers → cache (cache-aside, ~90% hits) → store. 20,000 / s at 3,000 per server needs 7 servers at 100%; 12 keeps them under 60%, and still under 70% with one down.",
      "Clicks: 302 so every click reaches us; the app drops a message on a queue and returns. Workers batch clicks into a columnar analytics store.",
      "Failure drill: two of everything on the request path. Losing a cache node shifts its misses to the store, which still has room.",
    ],
    tradeoffs: [
      "301 vs 302: 301 saves most of the traffic (and money) but you lose click counts and the ability to edit links. Some services use 301 for links with no analytics.",
      "Counter vs random codes: counters are collision-free but guessable (people can enumerate links); random codes cost a lookup per create.",
      "Key-value store vs SQL: a single-key lookup with no joins suits a partitioned KV store and it grows by adding nodes. SQL with replicas is fine at this size and easier to query.",
      "Async analytics means counts lag by seconds and a crashed worker can double-count unless writes are idempotent (dedupe by click id).",
    ],
    followUps: [
      "Custom aliases (tfn.in/diwali): check-and-insert with a uniqueness constraint; reserve them in a separate namespace from counter codes.",
      "Expiring links: store an expiry, check it on read, and clean up with a background job. Don't reuse expired codes for a while.",
      "Abuse: rate-limit creation per account and scan destinations against a malware list before activating the link.",
      "Multi-region: replicate the link table to every region (it's small per row and rarely written) and serve redirects locally.",
    ],
  },
};
