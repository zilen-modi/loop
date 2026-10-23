"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, X } from "lucide-react";
import { catalog, type Category, type NodeKind } from "@/lib/design/catalog";
import { fmtLatency, fmtRate } from "@/lib/design/engine";
import { evaluate, type DesignScenario, type Evaluation } from "@/lib/design/evaluate";
import { rateKey, type Design } from "@/lib/design/graph";

// Fixed light colours: an exported picture should read the same wherever it's pasted.
const INK = "#26231f";
const INK_3 = "#716c63";
const RULE = "#d3cec2";
const PAGE = "#fbfaf7";
const FAIL = "#b1442f";
const PASS = "#2e7a4d";
const HUE: Record<Category, string> = { users: "#5f5a52", edge: "#2f63a8", compute: "#2f7f73", data: "#6a55b0", async: "#9a6b12", external: "#a8456a" };
const NODE_W = 160;
const NODE_H = 52;
const PAD = 32;
const HEAD = 64;
const GAP_X = 96;
const GAP_Y = 26;

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Columns by hops from Users, so most links join neighbouring columns and read left to right like a
 * request. Boxes nobody links to go in a last column.
 */
function layout(d: Design) {
  const order = Object.keys(catalog) as NodeKind[];
  const kinds = d.nodes.map((n) => n.kind);
  const near = (k: NodeKind) => d.edges.flatMap(([a, b]) => (a === k ? [b] : b === k ? [a] : [])).filter((x) => kinds.includes(x));
  const col = new Map<NodeKind, number>([["client", 0]]);
  for (let queue: NodeKind[] = ["client"]; queue.length; ) {
    const k = queue.shift()!;
    for (const n of near(k)) {
      if (col.has(n)) continue;
      col.set(n, col.get(k)! + 1);
      queue.push(n);
    }
  }
  const last = Math.max(0, ...col.values()) + 1;
  for (const k of kinds) if (!col.has(k)) col.set(k, last);
  const rows = new Map<number, NodeKind[]>();
  for (const k of [...kinds].sort((a, b) => order.indexOf(a) - order.indexOf(b))) rows.set(col.get(k)!, [...(rows.get(col.get(k)!) ?? []), k]);
  const at = new Map<NodeKind, { x: number; y: number; col: number }>();
  for (const [c, ks] of rows) ks.forEach((k, i) => at.set(k, { x: PAD + c * (NODE_W + GAP_X), y: HEAD + PAD + i * (NODE_H + GAP_Y), col: c }));
  const width = PAD * 2 + (Math.max(...rows.keys()) + 1) * (NODE_W + GAP_X) - GAP_X;
  const height = HEAD + PAD * 2 + Math.max(...[...rows.values()].map((r) => r.length)) * (NODE_H + GAP_Y) - GAP_Y;
  return { at, width, height };
}

/** The design as a standalone SVG: boxes with their machine counts and load, links with their traffic. */
export function designSvg(s: DesignScenario, d: Design, ev: Evaluation) {
  const { at, width: w, height: h } = layout(d);
  const score = ev.checks.filter((c) => c.pass).length;
  const lines: string[] = [];
  const labels: string[] = [];
  lines.push(`<rect width="${w}" height="${h}" fill="${PAGE}"/>`);
  lines.push(`<text x="${PAD}" y="30" font-size="16" font-weight="600" fill="${INK}">${esc(s.title)}</text>`);
  lines.push(`<text x="${PAD}" y="50" font-size="12" fill="${score === ev.checks.length ? PASS : INK_3}">${score} / ${ev.checks.length} checks · $${ev.sim.costPerMonth.toLocaleString("en-US")} a month · ${esc(s.trafficLabel(1))}</text>`);
  for (const [a, b] of d.edges) {
    const pa = at.get(a);
    const pb = at.get(b);
    if (!pa || !pb) continue;
    const rate = (ev.sim.edgeRates[rateKey(a, b)] ?? 0) + (ev.sim.edgeRates[rateKey(b, a)] ?? 0);
    const hot = (ev.sim.load[a]?.utilization ?? 0) >= 1 || (ev.sim.load[b]?.utilization ?? 0) >= 1;
    const stroke = `stroke="${hot ? FAIL : rate ? INK_3 : RULE}" stroke-width="${rate ? 1.6 : 1}"${rate ? "" : ' stroke-dasharray="4 4"'}`;
    let path: string;
    let lx: number;
    let ly: number;
    if (pa.col === pb.col) {
      // same column: a curve along the right-hand side
      const [top, bottom] = pa.y < pb.y ? [pa, pb] : [pb, pa];
      const x = top.x + NODE_W;
      path = `M${x},${top.y + NODE_H / 2} C${x + 36},${top.y + NODE_H / 2} ${x + 36},${bottom.y + NODE_H / 2} ${x},${bottom.y + NODE_H / 2}`;
      lx = x + 30;
      ly = (top.y + bottom.y) / 2 + NODE_H / 2;
    } else {
      const [from, to] = pa.x < pb.x ? [pa, pb] : [pb, pa];
      const x1 = from.x + NODE_W;
      const y1 = from.y + NODE_H / 2;
      const x2 = to.x;
      const y2 = to.y + NODE_H / 2;
      const mid = (x1 + x2) / 2;
      path = `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`;
      lx = x2 - GAP_X * 0.3;
      ly = y2 + (y1 - y2) * 0.12;
    }
    lines.push(`<path d="${path}" fill="none" ${stroke}/>`);
    if (rate) labels.push(`<text x="${lx}" y="${ly + 3.5}" font-size="10" text-anchor="middle" fill="${INK_3}" stroke="${PAGE}" stroke-width="3" paint-order="stroke">${fmtRate(rate)}</text>`);
  }
  const boxes: string[] = [];
  for (const n of d.nodes) {
    const p = at.get(n.kind)!;
    const spec = catalog[n.kind];
    const u = ev.sim.load[n.kind]?.utilization;
    const over = (u ?? 0) >= 1;
    boxes.push(`<rect x="${p.x}" y="${p.y}" width="${NODE_W}" height="${NODE_H}" rx="10" fill="#fff" stroke="${over ? FAIL : RULE}"/>`);
    boxes.push(`<rect x="${p.x}" y="${p.y + 10}" width="3" height="${NODE_H - 20}" rx="1.5" fill="${HUE[spec.category]}"/>`);
    boxes.push(`<text x="${p.x + 12}" y="${p.y + 22}" font-size="13" font-weight="600" fill="${INK}">${esc(spec.short)}${n.kind === "client" ? "" : ` ×${n.count}`}</text>`);
    const sub = n.kind === "client" ? "peak traffic" : u === undefined ? "no traffic" : `${Math.round(u * 100)}% busy · ${fmtRate(ev.sim.load[n.kind]!.load)}`;
    boxes.push(`<text x="${p.x + 12}" y="${p.y + 39}" font-size="11" fill="${over ? FAIL : INK_3}">${esc(sub)}</text>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif">${lines.join("")}${boxes.join("")}${labels.join("")}</svg>`;
}

/** A plain-text record of the design and its results, for interview notes. */
export function designMarkdown(s: DesignScenario, d: Design, ev: Evaluation) {
  const score = ev.checks.filter((c) => c.pass).length;
  const lines: string[] = [];
  lines.push(`# ${s.title}`, "");
  lines.push(`**${score} / ${ev.checks.length} checks** · $${ev.sim.costPerMonth.toLocaleString("en-US")} a month · at ${s.trafficLabel(1)}`, "");
  lines.push("## Decisions", "");
  for (const dec of s.decisions) lines.push(`- **${dec.question}** ${dec.options.find((o) => o.value === d.decisions[dec.id])?.label ?? "Not decided"}`);
  lines.push("", "## Components", "", "| Component | Machines | Busy at peak | Cost a month |", "|---|---|---|---|");
  for (const n of d.nodes.filter((x) => x.kind !== "client")) {
    const u = ev.sim.load[n.kind]?.utilization;
    lines.push(`| ${catalog[n.kind].label} | ${n.count} | ${u === undefined ? "—" : `${Math.round(u * 100)}%`} | $${(catalog[n.kind].costPerMonth * n.count).toLocaleString("en-US")} |`);
  }
  lines.push("", "## Links", "");
  for (const [a, b] of d.edges) lines.push(`- ${catalog[a].label} ↔ ${catalog[b].label}`);
  lines.push("", "## Latency at peak", "");
  for (const m of s.metrics) {
    const f = ev.sim.flows[m.flow];
    lines.push(`- **${m.label}:** ${fmtLatency(f?.latencyMs ?? Infinity)}${f?.ok ? ` (${f.hops.map((h) => `${catalog[h.kind].short} ${h.ms.toFixed(1)}`).join(" + ")} ms)` : f?.reason ? ` (${f.reason})` : ""}`);
  }
  lines.push("", "## Checks", "");
  for (const c of ev.checks) lines.push(`- ${c.pass ? "✅" : "❌"} **${c.label}.** ${c.detail}`);
  lines.push("");
  return lines.join("\n");
}

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function svgToPng(svg: string, scale = 2): Promise<Blob> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.drawImage(img, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png"));
}

/** Download the design as a picture and as Markdown notes, or copy the notes. */
export function Export({ s, problemId, design, onClose }: { s: DesignScenario; problemId: string; design: Design; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const ev = useMemo(() => evaluate(s, design), [s, design]);
  const svg = useMemo(() => designSvg(s, design, ev), [s, design, ev]);
  const md = useMemo(() => designMarkdown(s, design, ev), [s, design, ev]);
  const [status, setStatus] = useState("");
  const png = async () => {
    try {
      download(`${problemId}-design.png`, await svgToPng(svg));
      setStatus("Picture downloaded.");
    } catch {
      setStatus("Couldn't make the picture in this browser; the SVG still works.");
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(md);
      setStatus("Notes copied.");
    } catch {
      setStatus("Couldn't copy here; download the notes instead.");
    }
  };
  return (
    <dialog ref={ref} className="lab-dialog" aria-labelledby="export-title" onClose={onClose} onCancel={onClose}>
      <header className="lab-dialog-head">
        <h2 id="export-title">Export this design</h2>
        <button className="icon-btn" onClick={() => ref.current?.close()} aria-label="Close"><X size={18} /></button>
      </header>
      <div className="lab-dialog-body">
        <div className="export-preview" aria-label="Preview of the picture" role="img" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="export-actions">
          <button className="btn small primary" onClick={png}><Download size={14} aria-hidden="true" /> Picture (PNG)</button>
          <button className="btn small" onClick={() => { download(`${problemId}-design.svg`, new Blob([svg], { type: "image/svg+xml" })); setStatus("SVG downloaded."); }}><Download size={14} aria-hidden="true" /> SVG</button>
          <button className="btn small" onClick={() => { download(`${problemId}-design.md`, new Blob([md], { type: "text/markdown" })); setStatus("Notes downloaded."); }}><Download size={14} aria-hidden="true" /> Notes (Markdown)</button>
          <button className="btn small" onClick={copy}><Copy size={14} aria-hidden="true" /> Copy notes</button>
        </div>
        <p role="status" className="compare-note" data-testid="export-status">{status}</p>
        <details className="export-md">
          <summary>Preview the notes</summary>
          <pre data-testid="export-md">{md}</pre>
        </details>
      </div>
    </dialog>
  );
}
