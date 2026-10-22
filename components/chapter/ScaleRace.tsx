"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { busiestStretch } from "@/content/problems/sliding-window/busiest-stretch";
import { mulberry32, randArray } from "@/content/problem-types";
import { runCases } from "@/lib/runner";

const SIZES = [1_000, 10_000, 100_000, 1_000_000];
const K = 1_000;
const LIMIT = 2_000;

type Cell = { state: "idle" | "running" | "done" | "stopped"; ms?: number };

/** Runs the recount and the slide on real data, in your browser, and times both. */
export default function ScaleRace() {
  const [rows, setRows] = useState<{ n: number; recount: Cell; slide: Cell }[]>(SIZES.map((n) => ({ n, recount: { state: "idle" }, slide: { state: "idle" } })));
  const [busy, setBusy] = useState(false);

  async function race() {
    setBusy(true);
    const data = SIZES.map((n) => randArray(mulberry32(n), n, 0, 10_000));
    for (const which of ["slide", "recount"] as const) {
      const src = which === "slide" ? busiestStretch.solution.js : busiestStretch.brute;
      for (let i = 0; i < SIZES.length; i++) {
        setRows((r) => r.map((row, j) => (j === i ? { ...row, [which]: { state: "running" } } : row)));
        const out = await runCases("js", src, busiestStretch.fn.js, [{ args: [data[i], Math.min(K, SIZES[i])], limitMs: LIMIT / 2 }]);
        const c = out.kind === "ran" ? out.cases[0] : undefined;
        const cell: Cell = c?.kind === "ok" ? { state: "done", ms: c.ms } : { state: "stopped" };
        setRows((r) => r.map((row, j) => (j === i ? { ...row, [which]: cell } : row)));
        if (cell.state === "stopped") {
          setRows((r) => r.map((row, j) => (j > i ? { ...row, [which]: { state: "stopped" } } : row)));
          break;
        }
      }
    }
    setBusy(false);
  }

  const show = (c: Cell) =>
    c.state === "idle" ? "—" : c.state === "running" ? "running…" : c.state === "stopped" ? "too slow, stopped" : c.ms! < 1 ? "< 1 ms" : `${Math.round(c.ms!).toLocaleString()} ms`;

  return (
    <div className="figure" data-interactive>
      <p className="fig-label">Scale race · k = 1,000, timed in your browser</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 10 }}>
        <thead>
          <tr style={{ color: "var(--ink-3)", textAlign: "left" }}>
            <th style={{ fontWeight: 500, padding: "4px 0" }}>Minutes (n)</th>
            <th style={{ fontWeight: 500 }}>Recount O(n·k)</th>
            <th style={{ fontWeight: 500 }}>Slide O(n)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.n} style={{ borderTop: "1px solid var(--rule)" }}>
              <td style={{ padding: "6px 0", fontFamily: "var(--mono)" }}>{r.n.toLocaleString()}</td>
              <td style={{ color: r.recount.state === "stopped" ? "var(--fail)" : "var(--ink)" }}>{show(r.recount)}</td>
              <td style={{ color: r.slide.state === "done" ? "var(--pass)" : "var(--ink)" }}>{show(r.slide)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn small" onClick={race} disabled={busy}><Play size={14} /> {busy ? "Racing…" : "Run the race"}</button>
    </div>
  );
}
