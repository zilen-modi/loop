import type { NodeKind } from "@/lib/design/catalog";
import type { Broken, FlowDef, Hop, Route } from "@/lib/design/engine";
import type { Graph } from "@/lib/design/graph";

// How requests move through a URL-shortener design. Each flow returns its hops; the engine adds
// up load, latency and link traffic. Partial hops on a broken route still count as load.

type Entry = { ok: true; hops: NodeKind[]; viaCdn: boolean } | { ok: false; reason: string };

/** Users → (CDN) → (load balancer) → app servers. */
function entry(g: Graph): Entry {
  const viaCdn = g.edge("client", "cdn");
  const from: NodeKind = viaCdn ? "cdn" : "client";
  if (g.edge(from, "lb") && g.edge("lb", "app")) return { ok: true, hops: viaCdn ? ["cdn", "lb", "app"] : ["lb", "app"], viaCdn };
  if (g.edge(from, "app")) {
    if (g.count("app") > 1) return { ok: false, reason: "Users can't spread across several app servers without a load balancer in front." };
    return { ok: true, hops: viaCdn ? ["cdn", "app"] : ["app"], viaCdn };
  }
  return { ok: false, reason: "Users can't reach the app servers. Connect Users → Load balancer → App servers." };
}

/** Share of redirects the CDN answers: only cached 301s. */
const cdnHit = (g: Graph, e: Entry, rate: number) => (e.ok && e.viaCdn && g.decisions.redirect === "301" ? rate : 0);

const redirect: FlowDef = {
  id: "redirect",
  label: "Redirect",
  route: (g, t): Route | Broken => {
    const e = entry(g);
    const rate = t.readsPerSec;
    if (!e.ok) return { broken: e.reason, rate };
    const pass = 1 - cdnHit(g, e, t.cdnHitRate); // share that gets past the CDN
    const hops: Hop[] = e.hops.map((k) => ({ kind: k, share: k === "cdn" ? 1 : pass }));
    const usesCache = g.edge("app", "cache");
    if (usesCache) hops.push({ kind: "cache", share: pass });
    const linked = (k: NodeKind) => g.edge("app", k) || (usesCache && g.edge("cache", k));
    const store: NodeKind | null = linked("replica") ? "replica" : linked("sql") ? "sql" : linked("kv") ? "kv" : null;
    if (!store) return { broken: "Redirects have no database to read from. Connect the app servers (or the cache) to a database.", rate, hops };
    hops.push({ kind: store, share: usesCache ? pass * (1 - t.cacheHitRate) : pass, from: usesCache && !g.edge("app", store) ? "cache" : "app" });
    if (g.decisions.analytics === "sync") {
      if (!g.edge("app", "analytics")) return { broken: "Synchronous analytics needs App servers → Analytics store.", rate, hops };
      hops.push({ kind: "analytics", share: pass, write: true, from: "app" });
    }
    return { rate, hops };
  },
};

const create: FlowDef = {
  id: "create",
  label: "New link",
  route: (g, t): Route | Broken => {
    const e = entry(g);
    const rate = t.writesPerSec;
    if (!e.ok) return { broken: e.reason };
    const hops: Hop[] = e.hops.map((k) => ({ kind: k, write: true }));
    const store: NodeKind | null = g.edge("app", "sql") ? "sql" : g.edge("app", "kv") ? "kv" : null; // replicas can't take writes
    if (!store)
      return {
        broken: g.edge("app", "replica") ? "Read replicas are read-only. New links must be written to the SQL primary or a key-value store." : "New links have nowhere to be stored. Connect App servers → a database.",
        rate,
        hops,
      };
    if (g.decisions.ids === "counter" && !g.edge("app", "idgen")) return { broken: "Counter-based IDs need App servers → ID service.", rate, hops };
    if (g.decisions.ids === "counter") hops.push({ kind: "idgen", write: true, from: "app" });
    if (g.decisions.ids === "random") hops.push({ kind: store, onPath: false, from: "app" }); // look the random code up first
    hops.push({ kind: store, write: true, from: "app" });
    if (store === "sql" && g.has("replica")) hops.push({ kind: "replica", write: true, onPath: false, from: "sql" }); // replication
    if (g.edge("app", "cache")) hops.push({ kind: "cache", write: true, onPath: false, from: "app" });
    return { rate, hops };
  },
};

const click: FlowDef = {
  id: "click",
  label: "Click recorded",
  route: (g, t): Route | Broken => {
    const e = entry(g);
    const rate = t.readsPerSec * (1 - cdnHit(g, e, t.cdnHitRate)); // clicks that reach the app servers
    const d = g.decisions.analytics;
    if (d === "async") {
      if (g.edge("app", "queue") && g.edge("queue", "worker") && g.edge("worker", "analytics"))
        return { rate, hops: [{ kind: "queue", write: true, from: "app" }, { kind: "worker", write: true }, { kind: "analytics", write: true }] };
      return { broken: "Async analytics needs App servers → Queue → Workers → Analytics store." };
    }
    if (d === "sync") {
      // the load is already counted on the redirect path; this flow only reports whether clicks land
      return g.edge("app", "analytics") ? { rate, hops: [{ kind: "analytics", write: true, share: 0, from: "app" }] } : { broken: "Synchronous analytics needs App servers → Analytics store." };
    }
    return { broken: "Clicks aren't recorded anywhere." };
  },
};

export const urlShortenerFlows: FlowDef[] = [redirect, create, click];
