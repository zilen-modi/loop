"use client";

import { createContext, useContext } from "react";
import {
  ChartColumn, Cog, Database, DatabaseBackup, Gauge, Globe, HardDrive, Hash, Inbox, KeyRound, Network, Radio, Search, Send, Server, Users, Waves, Zap,
  type LucideIcon,
} from "lucide-react";
import type { Category, NodeKind } from "@/lib/design/catalog";

export const kindIcon: Record<NodeKind, LucideIcon> = {
  client: Users, cdn: Globe, lb: Network, app: Server, cache: Zap, sql: Database, replica: DatabaseBackup, kv: KeyRound,
  idgen: Hash, queue: Inbox, worker: Cog, analytics: ChartColumn, objstore: HardDrive, search: Search, wsgw: Radio,
  stream: Waves, limiter: Gauge, provider: Send,
};

export const categoryColor: Record<Category, string> = {
  users: "var(--ink-2)",
  edge: "var(--hue-blue)",
  compute: "var(--hue-teal)",
  data: "var(--hue-violet)",
  async: "var(--hue-amber)",
  external: "var(--hue-rose)",
};

export const categoryLabel: Record<Category, string> = {
  users: "Users", edge: "Edge", compute: "Compute", data: "Data", async: "Async", external: "External",
};

/** Where each category sits, left to right, on the canvas lanes. */
export const laneOrder: Category[] = ["users", "edge", "compute", "async", "data", "external"];

export type NodeState = "idle" | "ok" | "busy" | "over" | "failed";

export const stateOf = (u: number | undefined, failed: boolean): NodeState =>
  failed ? "failed" : u === undefined ? "idle" : u >= 1 ? "over" : u > 0.7 ? "busy" : "ok";

export const stateColor: Record<NodeState, string> = {
  idle: "var(--ink-3)", ok: "var(--pass)", busy: "var(--warn)", over: "var(--fail)", failed: "var(--ink-3)",
};

/** Live numbers the canvas pieces read without being re-created on every change. */
export type LabLive = {
  util: Partial<Record<NodeKind, number>>;
  throughput: Partial<Record<NodeKind, number>>;
  rates: Record<string, number>;
  failed?: NodeKind;
  /** When set, everything else is dimmed. */
  highlight?: Set<NodeKind>;
  /** The hop a traced request is at, and the time it has taken so far. */
  trace?: { kind: NodeKind; ms: number; total?: number };
  reducedMotion: boolean;
};

export const LabContext = createContext<LabLive>({ util: {}, throughput: {}, rates: {}, reducedMotion: false });
export const useLab = () => useContext(LabContext);
