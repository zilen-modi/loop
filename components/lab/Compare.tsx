"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Save, Trash2, Upload, X } from "lucide-react";
import { catalog, type NodeKind } from "@/lib/design/catalog";
import { fmtLatency } from "@/lib/design/engine";
import { evaluate, type DesignScenario } from "@/lib/design/evaluate";
import type { Design } from "@/lib/design/graph";
import { problemsProgress, updateProblem } from "@/lib/progress";

export type SavedDesign = { name: string; design: Design; at: number };
export const MAX_SAVED = 5;

type Row = { label: string; a: string; b: string; group: string; good?: "a" | "b" };

/** Save designs by name and compare any two side by side: score, cost, latency, every check, machines and decisions. */
export function Compare({ s, problemId, current, onLoad, onClose }: { s: DesignScenario; problemId: string; current: Design; onLoad: (d: Design) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const saved = (problemsProgress.use()[problemId]?.saved as SavedDesign[] | undefined) ?? [];
  const [name, setName] = useState(`Design ${saved.length + 1}`);
  const [a, setA] = useState("current");
  const [b, setB] = useState(saved.length ? String(saved[saved.length - 1].at) : "current");
  const [onlyDiff, setOnlyDiff] = useState(false);
  const options = [{ key: "current", name: "Current design", design: current }, ...saved.map((x) => ({ key: String(x.at), name: x.name, design: x.design }))];
  const pick = (k: string) => options.find((o) => o.key === k) ?? options[0];
  const A = pick(a);
  const B = pick(b);

  const save = () => {
    const at = Date.now();
    const label = name.trim() || `Design ${saved.length + 1}`;
    updateProblem(problemId, (st) => ({ ...st, saved: [...((st.saved as SavedDesign[] | undefined) ?? []), { name: label, design: current, at }] }));
    setB(String(at));
    setName(`Design ${saved.length + 2}`);
  };
  const remove = (at: number) => {
    updateProblem(problemId, (st) => ({ ...st, saved: ((st.saved as SavedDesign[] | undefined) ?? []).filter((x) => x.at !== at) }));
    if (a === String(at)) setA("current");
    if (b === String(at)) setB("current");
  };

  const rows = useMemo(() => {
    const ea = evaluate(s, A.design);
    const eb = evaluate(s, B.design);
    const out: Row[] = [];
    const score = (e: typeof ea) => e.checks.filter((c) => c.pass).length;
    out.push({ group: "Summary", label: "Score", a: `${score(ea)} / ${ea.checks.length}`, b: `${score(eb)} / ${eb.checks.length}`, good: score(ea) === score(eb) ? undefined : score(ea) > score(eb) ? "a" : "b" });
    out.push({ group: "Summary", label: "Cost a month", a: `$${ea.sim.costPerMonth.toLocaleString("en-US")}`, b: `$${eb.sim.costPerMonth.toLocaleString("en-US")}`, good: ea.sim.costPerMonth === eb.sim.costPerMonth ? undefined : ea.sim.costPerMonth < eb.sim.costPerMonth ? "a" : "b" });
    for (const m of s.metrics) {
      const la = ea.sim.flows[m.flow]?.latencyMs ?? Infinity;
      const lb = eb.sim.flows[m.flow]?.latencyMs ?? Infinity;
      out.push({ group: "Summary", label: m.label, a: fmtLatency(la), b: fmtLatency(lb), good: Math.round(la) === Math.round(lb) ? undefined : la < lb ? "a" : "b" });
    }
    const busiest = (e: typeof ea) => (e.sim.bottleneck ? `${catalog[e.sim.bottleneck.kind].short} ${Math.round(e.sim.bottleneck.utilization * 100)}%` : "—");
    out.push({ group: "Summary", label: "Busiest", a: busiest(ea), b: busiest(eb) });
    for (const c of s.criteria) {
      const pa = ea.checks.find((x) => x.id === c.id)!.pass;
      const pb = eb.checks.find((x) => x.id === c.id)!.pass;
      out.push({ group: "Checks", label: c.short ?? c.label, a: pa ? "✓ pass" : "✗ fail", b: pb ? "✓ pass" : "✗ fail", good: pa === pb ? undefined : pa ? "a" : "b" });
    }
    const kinds = [...new Set([...A.design.nodes, ...B.design.nodes].map((n) => n.kind))].filter((k) => k !== "client") as NodeKind[];
    kinds.sort((x, y) => Object.keys(catalog).indexOf(x) - Object.keys(catalog).indexOf(y));
    const count = (d: Design, k: NodeKind) => d.nodes.find((n) => n.kind === k)?.count;
    for (const k of kinds) out.push({ group: "Machines", label: catalog[k].label, a: String(count(A.design, k) ?? "—"), b: String(count(B.design, k) ?? "—") });
    for (const d of s.decisions) {
      const label = (v?: string) => d.options.find((o) => o.value === v)?.label ?? "Not decided";
      out.push({ group: "Decisions", label: d.question, a: label(A.design.decisions[d.id]), b: label(B.design.decisions[d.id]) });
    }
    return out;
  }, [s, A.design, B.design]);
  const shown = onlyDiff ? rows.filter((r) => r.a !== r.b) : rows;
  const differences = rows.filter((r) => r.a !== r.b).length;

  return (
    <dialog ref={ref} className="lab-dialog" aria-labelledby="compare-title" onClose={onClose} onCancel={onClose}>
      <header className="lab-dialog-head">
        <h2 id="compare-title">Compare designs</h2>
        <button className="icon-btn" onClick={() => ref.current?.close()} aria-label="Close"><X size={18} /></button>
      </header>

      <div className="lab-dialog-body">
        <form className="compare-save" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <label htmlFor="compare-name">Save the current design as</label>
          <input id="compare-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          <button className="btn small" type="submit" disabled={saved.length >= MAX_SAVED}><Save size={14} aria-hidden="true" /> Save</button>
          {saved.length >= MAX_SAVED && <span className="compare-note">You can keep {MAX_SAVED}; delete one to save another.</span>}
        </form>

        {saved.length > 0 && (
          <ul className="compare-saved" aria-label="Saved designs">
            {saved.map((x) => (
              <li key={x.at}>
                <span className="compare-saved-name">{x.name}</span>
                <span className="compare-note">{new Date(x.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                <button className="btn small" onClick={() => { onLoad(x.design); ref.current?.close(); }} aria-label={`Load ${x.name} onto the canvas`}><Upload size={14} aria-hidden="true" /> Load</button>
                <button className="btn small" onClick={() => remove(x.at)} aria-label={`Delete ${x.name}`}><Trash2 size={14} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        )}

        <div className="compare-pick">
          <label>
            <span>Left</span>
            <select value={a} onChange={(e) => setA(e.target.value)} aria-label="Left design">
              {options.map((o) => <option key={o.key} value={o.key}>{o.name}</option>)}
            </select>
          </label>
          <label>
            <span>Right</span>
            <select value={b} onChange={(e) => setB(e.target.value)} aria-label="Right design">
              {options.map((o) => <option key={o.key} value={o.key}>{o.name}</option>)}
            </select>
          </label>
          <label className="compare-only">
            <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} /> Only differences ({differences})
          </label>
        </div>

        <div className="compare-table-wrap">
          <table className="compare-table" data-testid="compare-table">
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">Measure</span></th>
                <th scope="col">{A.name}</th>
                <th scope="col">{B.name}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r, i) => (
                <tr key={r.group + r.label} data-diff={r.a !== r.b || undefined} className={i === 0 || shown[i - 1].group !== r.group ? "group-start" : undefined}>
                  <th scope="row">
                    {(i === 0 || shown[i - 1].group !== r.group) && <span className="compare-group">{r.group}</span>}
                    {r.label}
                  </th>
                  <td data-good={r.good === "a" || undefined} data-bad={r.a.startsWith("✗") || undefined}>{r.a}</td>
                  <td data-good={r.good === "b" || undefined} data-bad={r.b.startsWith("✗") || undefined}>{r.b}</td>
                </tr>
              ))}
              {!shown.length && (
                <tr>
                  <td colSpan={3} className="compare-note">The two designs are the same.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </dialog>
  );
}
