// The components a design lab can use. Numbers are round, documented estimates for teaching,
// not benchmarks. Every kind appears at most once on a canvas; "count" is how many machines it runs on.

export type NodeKind =
  | "client" | "cdn" | "lb" | "app" | "cache" | "sql" | "replica" | "kv" | "idgen" | "queue" | "worker" | "analytics"
  | "objstore" | "search" | "wsgw" | "stream" | "limiter" | "provider";

export type Category = "users" | "edge" | "compute" | "data" | "async" | "external";

export type Spec = {
  label: string;
  short: string;
  category: Category;
  /** Operations per second one machine handles (reads, for stores with a separate write capacity). */
  capacity: number;
  writeCapacity?: number;
  /** How many operations one write costs, e.g. 3 for a store that keeps three copies. */
  writeCost?: number;
  latencyMs: number;
  writeLatencyMs?: number;
  costPerMonth: number;
  maxCount: number;
  fixedCount?: number;
  /** Run by someone else: you can't add machines, and the failure drill takes it down entirely. */
  external?: boolean;
  /** Fewer machines than this can't serve requests at all (outside a failure drill). */
  minCount?: { count: number; reason: string };
  note: string;
};

export const catalog: Record<NodeKind, Spec> = {
  client: { label: "Users", short: "Users", category: "users", capacity: Infinity, latencyMs: 0, costPerMonth: 0, maxCount: 1, fixedCount: 1, note: "Where traffic comes from." },
  cdn: { label: "CDN", short: "CDN", category: "edge", capacity: 1_000_000, latencyMs: 8, costPerMonth: 200, maxCount: 1, fixedCount: 1, note: "Edge caches close to users. Can only answer requests whose responses are cacheable." },
  lb: { label: "Load balancer", short: "LB", category: "edge", capacity: 50_000, latencyMs: 1, costPerMonth: 20, maxCount: 10, note: "Spreads requests across app servers. 50k req/s each." },
  app: { label: "App servers", short: "App", category: "compute", capacity: 3_000, latencyMs: 5, costPerMonth: 70, maxCount: 60, note: "Stateless API servers. 3k req/s each." },
  cache: { label: "Cache (Redis)", short: "Cache", category: "data", capacity: 100_000, latencyMs: 1, costPerMonth: 150, maxCount: 10, note: "In-memory key-value cache. 100k ops/s per node." },
  sql: { label: "SQL primary", short: "SQL", category: "data", capacity: 10_000, writeCapacity: 3_000, latencyMs: 10, writeLatencyMs: 15, costPerMonth: 400, maxCount: 1, fixedCount: 1, note: "Relational database, one primary. 10k reads/s or 3k writes/s." },
  replica: { label: "Read replicas", short: "Replica", category: "data", capacity: 10_000, latencyMs: 10, costPerMonth: 300, maxCount: 10, note: "Read-only copies of the SQL primary. 10k reads/s each. Can be promoted if the primary fails." },
  kv: {
    label: "Key-value store", short: "KV", category: "data", capacity: 20_000, writeCost: 3, latencyMs: 5, costPerMonth: 250, maxCount: 30,
    minCount: { count: 3, reason: "A key-value store keeps 3 copies of each item, so it needs at least 3 nodes." },
    note: "Partitioned store (Dynamo/Cassandra style), 3 copies of each item. 20k ops/s per node; each write costs 3 ops.",
  },
  idgen: { label: "ID service", short: "IDs", category: "compute", capacity: 50_000, latencyMs: 1, costPerMonth: 30, maxCount: 5, note: "Hands out ranges of unique counter values to app servers." },
  queue: { label: "Queue", short: "Queue", category: "async", capacity: 100_000, latencyMs: 2, costPerMonth: 100, maxCount: 5, note: "Durable message queue (Kafka/SQS style). 100k msgs/s per node." },
  worker: { label: "Workers", short: "Workers", category: "async", capacity: 5_000, latencyMs: 0, costPerMonth: 50, maxCount: 40, note: "Consume queued messages. 5k msgs/s each." },
  analytics: { label: "Analytics store", short: "Analytics", category: "data", capacity: 50_000, latencyMs: 20, costPerMonth: 300, maxCount: 10, note: "Columnar store for click events. 50k events/s per node ingest; 20 ms per synchronous write." },
  objstore: { label: "Object storage", short: "Objects", category: "data", capacity: 10_000, latencyMs: 30, costPerMonth: 50, maxCount: 20, note: "S3-style storage for files and media: very durable and cheap per GB, about 30 ms to the first byte. 10k req/s per unit here." },
  search: { label: "Search index", short: "Search", category: "data", capacity: 2_000, writeCapacity: 1_000, latencyMs: 25, writeLatencyMs: 50, costPerMonth: 350, maxCount: 20, note: "Elasticsearch-style inverted index. 2k queries/s per node; indexing a document is slower than a query (1k docs/s)." },
  wsgw: { label: "WebSocket gateway", short: "WS", category: "edge", capacity: 20_000, latencyMs: 2, costPerMonth: 120, maxCount: 50, note: "Holds long-lived connections (about 100k per machine) and pushes messages to clients. 20k msgs/s each." },
  stream: { label: "Stream (partitions)", short: "Stream", category: "async", capacity: 10_000, latencyMs: 5, costPerMonth: 40, maxCount: 200, note: "Kafka-style partitioned log you can replay. Order is kept within a partition. Count = partitions, 10k msgs/s each." },
  limiter: { label: "Rate limiter", short: "Limiter", category: "edge", capacity: 50_000, latencyMs: 1, costPerMonth: 60, maxCount: 10, note: "Checks every request against its client's limit (token bucket) before it reaches the app. 50k checks/s each." },
  provider: { label: "Notification provider", short: "Provider", category: "external", capacity: 5_000, latencyMs: 200, costPerMonth: 0, maxCount: 1, fixedCount: 1, external: true, note: "Third-party SMS, push or email service. Your account allows 5k sends/s; you can't scale it, and sometimes it goes down." },
};

export const kindsInPalette = (Object.keys(catalog) as NodeKind[]).filter((k) => k !== "client");
