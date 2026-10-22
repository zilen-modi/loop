// A small, deterministic capacity model for system-design labs. It's a teaching tool: numbers are
// round, documented estimates, not benchmarks. Every component kind appears at most once on the
// canvas; "count" is how many machines it runs on.

export type NodeKind = "client" | "cdn" | "lb" | "app" | "cache" | "sql" | "replica" | "kv" | "idgen" | "queue" | "worker" | "analytics";

export type DesignNode = { kind: NodeKind; count: number; x: number; y: number };
export type Design = { nodes: DesignNode[]; edges: [NodeKind, NodeKind][]; decisions: Record<string, string> };

export type Spec = {
  label: string;
  short: string;
  /** Operations per second one machine handles. For the primary database: reads; writes use writeCapacity. */
  capacity: number;
  writeCapacity?: number;
  latencyMs: number;
  writeLatencyMs?: number;
  costPerMonth: number;
  maxCount: number;
  fixedCount?: number;
  note: string;
};

export const catalog: Record<NodeKind, Spec> = {
  client: { label: "Users", short: "Users", capacity: Infinity, latencyMs: 0, costPerMonth: 0, maxCount: 1, fixedCount: 1, note: "Where traffic comes from." },
  cdn: { label: "CDN", short: "CDN", capacity: 1_000_000, latencyMs: 8, costPerMonth: 200, maxCount: 1, fixedCount: 1, note: "Edge caches close to users. Can only answer requests whose responses are cacheable." },
  lb: { label: "Load balancer", short: "LB", capacity: 50_000, latencyMs: 1, costPerMonth: 20, maxCount: 10, note: "Spreads requests across app servers. 50k req/s each." },
  app: { label: "App servers", short: "App", capacity: 3_000, latencyMs: 5, costPerMonth: 70, maxCount: 60, note: "Stateless API servers. 3k req/s each." },
  cache: { label: "Cache (Redis)", short: "Cache", capacity: 100_000, latencyMs: 1, costPerMonth: 150, maxCount: 10, note: "In-memory key-value cache. 100k ops/s per node." },
  sql: { label: "SQL primary", short: "SQL", capacity: 10_000, writeCapacity: 3_000, latencyMs: 10, writeLatencyMs: 15, costPerMonth: 400, maxCount: 1, fixedCount: 1, note: "Relational database, one primary. 10k reads/s or 3k writes/s." },
  replica: { label: "Read replicas", short: "Replica", capacity: 10_000, latencyMs: 10, costPerMonth: 300, maxCount: 10, note: "Read-only copies of the SQL primary. 10k reads/s each. Can be promoted if the primary fails." },
  kv: { label: "Key-value store", short: "KV", capacity: 20_000, latencyMs: 5, costPerMonth: 250, maxCount: 30, note: "Partitioned store (Dynamo/Cassandra style), 3 copies of each item. 20k ops/s per node; each write costs 3 ops." },
  idgen: { label: "ID service", short: "IDs", capacity: 50_000, latencyMs: 1, costPerMonth: 30, maxCount: 5, note: "Hands out ranges of unique counter values to app servers." },
  queue: { label: "Queue", short: "Queue", capacity: 100_000, latencyMs: 2, costPerMonth: 100, maxCount: 5, note: "Durable message queue (Kafka/SQS style). 100k msgs/s per node." },
  worker: { label: "Workers", short: "Workers", capacity: 5_000, latencyMs: 0, costPerMonth: 50, maxCount: 40, note: "Consume queued messages. 5k msgs/s each." },
  analytics: { label: "Analytics store", short: "Analytics", capacity: 50_000, latencyMs: 20, costPerMonth: 300, maxCount: 10, note: "Columnar store for click events. 50k events/s per node ingest; 20 ms per synchronous write." },
};

export const kindsInPalette: NodeKind[] = ["cdn", "lb", "app", "cache", "sql", "replica", "kv", "idgen", "queue", "worker", "analytics"];

export type Traffic = { readsPerSec: number; writesPerSec: number; cacheHitRate: number; cdnHitRate: number };

export type FlowResult = { ok: boolean; reason?: string; latencyMs: number; path: NodeKind[] };

export type SimResult = {
  read: FlowResult;   // the cache-miss path, the slow case
  write: FlowResult;
  analytics: FlowResult;
  load: Partial<Record<NodeKind, { load: number; utilization: number }>>;
  bottleneck?: { kind: NodeKind; utilization: number };
  costPerMonth: number;
};

const ok = (latencyMs: number, path: NodeKind[]): FlowResult => ({ ok: true, latencyMs, path });
const broken = (reason: string): FlowResult => ({ ok: false, reason, latencyMs: Infinity, path: [] });

/**
 * Routes traffic through the design and estimates load, utilisation and latency.
 * `override` changes machine counts (used to simulate a failure).
 */
export function simulate(design: Design, t: Traffic, override: Partial<Record<NodeKind, number>> = {}): SimResult {
  const count = (k: NodeKind) => {
    const n = design.nodes.find((x) => x.kind === k);
    return Math.max(0, override[k] ?? (n ? n.count : 0));
  };
  const has = (k: NodeKind) => count(k) > 0;
  // Links are undirected: what matters is that two components can talk.
  const edge = (a: NodeKind, b: NodeKind) => has(a) && has(b) && design.edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const d = design.decisions;

  const reads: Partial<Record<NodeKind, number>> = {};
  const writes: Partial<Record<NodeKind, number>> = {};
  const add = (m: Partial<Record<NodeKind, number>>, k: NodeKind, v: number) => (m[k] = (m[k] ?? 0) + v);

  // ——— Entry: users → (CDN) → (load balancer) → app servers
  type Entry = { ok: true; path: NodeKind[]; viaCdn: boolean } | { ok: false; reason: string };
  const entry = ((): Entry => {
    const viaCdn = edge("client", "cdn");
    const from: NodeKind = viaCdn ? "cdn" : "client";
    if (edge(from, "lb") && edge("lb", "app")) return { ok: true, path: viaCdn ? ["cdn", "lb", "app"] : ["lb", "app"], viaCdn };
    if (edge(from, "app")) {
      if (count("app") > 1) return { ok: false, reason: "Users can't spread across several app servers without a load balancer in front." };
      return { ok: true, path: viaCdn ? ["cdn", "app"] : ["app"], viaCdn };
    }
    return { ok: false, reason: "Users can't reach the app servers. Connect Users → Load balancer → App servers." };
  })();

  // ——— Reads (redirects)
  let read: FlowResult = broken("");
  let clicksReachingApp = t.readsPerSec;
  if (!entry.ok) read = broken(entry.reason);
  else {
    const cdnHit = entry.viaCdn && d.redirect === "301" ? t.cdnHitRate : 0;
    const r = t.readsPerSec * (1 - cdnHit);
    clicksReachingApp = r;
    for (const k of entry.path) add(reads, k, k === "cdn" ? t.readsPerSec : r);
    const usesCache = edge("app", "cache");
    const misses = usesCache ? r * (1 - t.cacheHitRate) : r;
    if (usesCache) add(reads, "cache", r);
    const from = (k: NodeKind) => edge("app", k) || (usesCache && edge("cache", k));
    const store: NodeKind | null = from("replica") ? "replica" : from("sql") ? "sql" : from("kv") ? "kv" : null;
    if (!store) read = broken("Redirects have no database to read from. Connect the app servers (or the cache) to a database.");
    else {
      add(reads, store, misses);
      const path: NodeKind[] = [...entry.path, ...(usesCache ? (["cache"] as NodeKind[]) : []), store];
      if (d.analytics === "sync") {
        if (!edge("app", "analytics")) read = broken("Synchronous analytics needs App servers → Analytics store.");
        else {
          add(writes, "analytics", r);
          path.push("analytics");
        }
      }
      if (read.reason === "") read = ok(0, path);
    }
  }

  // ——— Writes (creating short links)
  let write: FlowResult = broken("");
  if (!entry.ok) write = broken(entry.reason);
  else {
    const w = t.writesPerSec;
    for (const k of entry.path) add(writes, k, w);
    const store: NodeKind | null = edge("app", "sql") ? "sql" : edge("app", "kv") ? "kv" : null; // replicas can't take writes
    const path: NodeKind[] = [...entry.path];
    if (!store) write = broken(edge("app", "replica") ? "Read replicas are read-only. New links must be written to the SQL primary or a key-value store." : "New links have nowhere to be stored. Connect App servers → a database.");
    else if (d.ids === "counter" && !edge("app", "idgen")) write = broken("Counter-based IDs need App servers → ID service.");
    else {
      if (d.ids === "counter") {
        add(writes, "idgen", w);
        path.push("idgen");
      } else if (d.ids === "random") add(reads, store, w); // look up the random code before using it
      add(writes, store, w);
      if (store === "sql" && has("replica")) add(writes, "replica", w); // replication
      if (edge("app", "cache")) add(writes, "cache", w);
      path.push(store);
      write = ok(0, path);
    }
  }

  // ——— Click analytics
  let analytics: FlowResult;
  if (d.analytics === "async") {
    if (edge("app", "queue") && edge("queue", "worker") && edge("worker", "analytics")) {
      add(writes, "queue", clicksReachingApp);
      add(writes, "worker", clicksReachingApp);
      add(writes, "analytics", clicksReachingApp);
      analytics = ok(0, ["queue", "worker", "analytics"]);
    } else analytics = broken("Async analytics needs App servers → Queue → Workers → Analytics store.");
  } else if (d.analytics === "sync") analytics = edge("app", "analytics") ? ok(0, ["analytics"]) : broken("Synchronous analytics needs App servers → Analytics store.");
  else analytics = broken("Clicks aren't recorded anywhere.");

  // ——— Utilisation and latency
  const load: SimResult["load"] = {};
  for (const n of design.nodes) {
    const k = n.kind;
    if (k === "client" || !has(k)) continue;
    const spec = catalog[k];
    const rd = reads[k] ?? 0;
    const wr = writes[k] ?? 0;
    let utilization: number;
    if (k === "sql") utilization = rd / spec.capacity + wr / (spec.writeCapacity ?? spec.capacity);
    else if (k === "kv") utilization = (rd + 3 * wr) / (spec.capacity * count(k));
    else utilization = (rd + wr) / (spec.capacity * count(k));
    load[k] = { load: rd + wr, utilization };
  }
  if (has("kv") && count("kv") < 3 && override.kv === undefined && (read.path.includes("kv") || write.path.includes("kv")))
    read = write = broken("A key-value store keeps 3 copies of each item, so it needs at least 3 nodes.");

  const latencyOf = (k: NodeKind, isWrite: boolean) => {
    const spec = catalog[k];
    const base = isWrite ? (spec.writeLatencyMs ?? spec.latencyMs) : spec.latencyMs;
    const u = load[k]?.utilization ?? 0;
    return base / Math.max(0.05, 1 - Math.min(u, 0.99)); // queueing: slower as a machine fills up
  };
  const finish = (f: FlowResult, isWrite: boolean): FlowResult => {
    if (!f.ok) return f;
    const over = f.path.find((k) => (load[k]?.utilization ?? 0) >= 1);
    if (over) return { ...f, ok: false, reason: `Overloaded: ${catalog[over].label} at ${Math.round(load[over]!.utilization * 100)}% of capacity.`, latencyMs: Infinity };
    return { ...f, latencyMs: f.path.reduce((s, k) => s + latencyOf(k, isWrite && k !== "lb" && k !== "app" && k !== "cdn"), 0) };
  };
  read = finish(read, false);
  write = finish(write, true);
  analytics = finish(analytics, true);

  let bottleneck: SimResult["bottleneck"];
  for (const [k, v] of Object.entries(load) as [NodeKind, { utilization: number }][]) if (!bottleneck || v.utilization > bottleneck.utilization) bottleneck = { kind: k, utilization: v.utilization };

  const costPerMonth = design.nodes.reduce((s, n) => s + catalog[n.kind].costPerMonth * (n.kind === "client" ? 0 : n.count), 0);
  return { read, write, analytics, load, bottleneck, costPerMonth };
}

/** What happens if one machine of a kind fails. */
export function failureOverride(design: Design, kind: NodeKind): { override: Partial<Record<NodeKind, number>>; note: string } {
  const n = design.nodes.find((x) => x.kind === kind);
  if (!n) return { override: {}, note: "" };
  if (kind === "sql") {
    const replicas = design.nodes.find((x) => x.kind === "replica")?.count ?? 0;
    return replicas > 0
      ? { override: { replica: replicas - 1 }, note: "The SQL primary fails; a replica is promoted to take its place." }
      : { override: { sql: 0 }, note: "The SQL primary fails and there's no replica to promote." };
  }
  return { override: { [kind]: n.count - 1 }, note: `One ${catalog[kind].label.toLowerCase()} machine fails (${n.count} → ${n.count - 1}).` };
}

export const fmtLatency = (ms: number) => (Number.isFinite(ms) ? `${Math.round(ms)} ms` : "fails");
export const fmtPct = (u: number) => `${Math.round(u * 100)}%`;
