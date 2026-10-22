import type { NodeKind } from "./catalog";

export type DesignNode = { kind: NodeKind; count: number; x: number; y: number };
export type Design = { nodes: DesignNode[]; edges: [NodeKind, NodeKind][]; decisions: Record<string, string> };

/** Read-only questions a scenario's routing asks about a design (with any failure applied). */
export type Graph = {
  decisions: Record<string, string>;
  count: (k: NodeKind) => number;
  has: (k: NodeKind) => boolean;
  /** Links are undirected: what matters is that two components can talk. */
  edge: (a: NodeKind, b: NodeKind) => boolean;
  /** The first of `candidates` linked to any of `from`, or null. */
  firstLinked: (from: NodeKind[], candidates: NodeKind[]) => NodeKind | null;
  /** True when this count comes from the failure drill rather than the design. */
  overridden: (k: NodeKind) => boolean;
  /** A link drawn in the design, even if one end is down in the failure drill. */
  wired: (a: NodeKind, b: NodeKind) => boolean;
};

export function makeGraph(design: Design, override: Partial<Record<NodeKind, number>> = {}): Graph {
  const count = (k: NodeKind) => {
    const n = design.nodes.find((x) => x.kind === k);
    return Math.max(0, override[k] ?? (n ? n.count : 0));
  };
  const has = (k: NodeKind) => count(k) > 0;
  const edge = (a: NodeKind, b: NodeKind) => has(a) && has(b) && design.edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  return {
    decisions: design.decisions,
    count,
    has,
    edge,
    firstLinked: (from, candidates) => candidates.find((c) => from.some((f) => edge(f, c))) ?? null,
    overridden: (k) => override[k] !== undefined,
    wired: (a, b) => design.nodes.some((n) => n.kind === a) && design.nodes.some((n) => n.kind === b) && design.edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a)),
  };
}

export const rateKey = (from: NodeKind, to: NodeKind) => `${from}>${to}`;
