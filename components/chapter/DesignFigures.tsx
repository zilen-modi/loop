"use client";

import { useState } from "react";

// Interactive figures for the LLD and HLD chapters. Each one is small, deterministic and quiet.

const PHASES = [
  { name: "Clarify", minutes: 10, points: ["Ask about scale, inputs and what 'done' means.", "Write the requirements and your assumptions where the interviewer can see them.", "Agree on the public API: method names, arguments, return values, errors."] },
  { name: "Model", minutes: 10, points: ["List the nouns (entities) and verbs (use cases).", "Decide which class owns each behaviour.", "Spot the part most likely to change and put it behind an interface."] },
  { name: "Core", minutes: 35, points: ["Build the happy path end to end before any edge case.", "Keep state in memory, behind small repository classes.", "Run it after every method or two; never write 40 minutes of code blind."] },
  { name: "Extend", minutes: 20, points: ["The interviewer adds a requirement. Expect it.", "A good design absorbs it with a new class or a small change, not a rewrite.", "Say what you'd change and why before typing."] },
  { name: "Demo", minutes: 15, points: ["Run a short driver that exercises every use case.", "Show validation: what happens with bad input.", "Walk through the design, then name what you'd do with more time."] },
];

/** The 90-minute round as a timeline; pick a phase to see what to do in it. */
export function RoundTimeline() {
  const [i, setI] = useState(0);
  const total = PHASES.reduce((s, p) => s + p.minutes, 0);
  let start = 0;
  const starts = PHASES.map((p) => ((start += p.minutes), start - p.minutes));
  return (
    <div className="figure" data-interactive>
      <p className="fig-label">Try it · a {total}-minute machine-coding round</p>
      <div role="tablist" aria-label="Phases" className="rt-tabs" style={{ display: "flex", gap: 3, marginBottom: 10 }}>
        {PHASES.map((p, j) => (
          <button
            key={p.name}
            role="tab"
            aria-selected={i === j}
            onClick={() => setI(j)}
            style={{
              flex: p.minutes,
              minWidth: 0,
              padding: "8px 4px",
              borderRadius: 6,
              border: `1.5px solid ${i === j ? "var(--accent)" : "var(--rule)"}`,
              background: i === j ? "var(--accent-soft)" : "transparent",
              color: "var(--ink)",
              font: "500 12px var(--sans)",
              cursor: "pointer",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {p.name}
            <span style={{ display: "block", fontWeight: 400, fontSize: 12, color: "var(--ink-3)" }}>{p.minutes} min</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={PHASES[i].name}>
        <p style={{ margin: "0 0 4px", fontWeight: 600 }}>
          Minutes {starts[i]}–{starts[i] + PHASES[i].minutes}: {PHASES[i].name.toLowerCase()}
        </p>
        <ul style={{ margin: 0, paddingLeft: 18, color: "var(--ink-2)" }}>{PHASES[i].points.map((x) => <li key={x}>{x}</li>)}</ul>
      </div>
    </div>
  );
}

/** Split a bill in whole paise, and see why floating-point rupees go wrong. */
export function SplitCalculator() {
  const [rupees, setRupees] = useState("100");
  const [n, setN] = useState(3);
  const paise = Math.max(0, Math.round(Number(rupees || 0) * 100));
  const base = Math.floor(paise / n);
  const extra = paise % n;
  const shares = Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
  const naive = Number((paise / 100 / n).toFixed(2));
  const naiveTotal = Math.round(naive * n * 100);
  const fmt = (p: number) => `₹${(p / 100).toFixed(2)}`;
  return (
    <div className="figure" data-interactive>
      <p className="fig-label">Try it · split a bill equally</p>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 10, fontSize: 13, color: "var(--ink-2)" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Bill ₹
          <input value={rupees} onChange={(e) => setRupees(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" aria-label="Bill in rupees" style={{ width: 90, height: 30, borderRadius: 6, border: "1px solid var(--rule-2)", background: "var(--page)", color: "var(--ink)", padding: "0 8px", font: "14px var(--mono)" }} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Friends
          <input type="range" min={2} max={7} value={n} onChange={(e) => setN(+e.target.value)} aria-label="Number of friends" />
          <span style={{ fontFamily: "var(--mono)" }}>{n}</span>
        </label>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {shares.map((s, i) => (
          <span key={i} style={{ fontFamily: "var(--mono)", fontSize: 13, padding: "6px 8px", borderRadius: 6, border: `1.5px solid ${i < extra ? "var(--accent)" : "var(--rule)"}`, background: i < extra ? "var(--accent-soft)" : "transparent" }}>
            {fmt(s)}
          </span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
        <div style={{ background: "var(--pass-soft)", color: "var(--pass)", borderRadius: 8, padding: "8px 10px" }}>
          <strong style={{ fontWeight: 600 }}>Whole paise</strong> · shares add up to {fmt(shares.reduce((a, b) => a + b, 0))}
          <div style={{ opacity: 0.85 }}>{extra ? `The first ${extra} ${extra === 1 ? "friend pays" : "friends pay"} 1 paisa more.` : "It divides exactly."}</div>
        </div>
        <div style={{ background: naiveTotal === paise ? "var(--page-2)" : "var(--fail-soft)", color: naiveTotal === paise ? "var(--ink-2)" : "var(--fail)", borderRadius: 8, padding: "8px 10px" }}>
          <strong style={{ fontWeight: 600 }}>Rounded rupees</strong> · {n} × {fmt(Math.round(naive * 100))} = {fmt(naiveTotal)}
          <div style={{ opacity: 0.85 }}>{naiveTotal === paise ? "Lucky this time." : `${fmt(Math.abs(paise - naiveTotal))} ${naiveTotal < paise ? "goes missing" : "appears from nowhere"}.`}</div>
        </div>
      </div>
    </div>
  );
}

const DAY = 86_400;
const pick = <T,>(label: string, value: T, set: (v: T) => void, options: [T, string][]) => (
  <label style={{ display: "grid", gap: 2, fontSize: 12, color: "var(--ink-3)" }}>
    {label}
    <select value={String(value)} onChange={(e) => set(options.find(([v]) => String(v) === e.target.value)![0])} style={{ height: 30, borderRadius: 6, border: "1px solid var(--rule-2)", background: "var(--page)", color: "var(--ink)", padding: "0 6px", font: "13px var(--sans)" }}>
      {options.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}
    </select>
  </label>
);

const round = (x: number) => {
  if (x < 10) return x.toFixed(1).replace(/\.0$/, "");
  const p = 10 ** (Math.floor(Math.log10(x)) - 1);
  return (Math.round(x / p) * p).toLocaleString("en-US");
};
const bytes = (b: number) => {
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let i = 0;
  while (b >= 1000 && i < units.length - 1) {
    b /= 1000;
    i++;
  }
  return `${round(b)} ${units[i]}`;
};

/** Back-of-the-envelope estimation: from users to requests per second, storage and machines. */
export function Estimator() {
  const [dau, setDau] = useState(10_000_000);
  const [writes, setWrites] = useState(1);
  const [ratio, setRatio] = useState(10);
  const [peak, setPeak] = useState(5);
  const [size, setSize] = useState(1000);
  const [years, setYears] = useState(5);
  const wAvg = (dau * writes) / DAY;
  const rAvg = wAvg * ratio;
  const storage = dau * writes * 365 * years * size;
  const servers = Math.ceil(((rAvg + wAvg) * peak) / (3000 * 0.7));
  const out = (label: string, value: string, note: string) => (
    <div style={{ background: "var(--page-2)", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{label}</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 15 }} data-testid={label}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{note}</div>
    </div>
  );
  return (
    <div className="figure" data-interactive>
      <p className="fig-label">Try it · estimate before you design</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 12 }}>
        {pick("Daily active users", dau, setDau, [[1_000_000, "1 M"], [10_000_000, "10 M"], [50_000_000, "50 M"], [100_000_000, "100 M"], [500_000_000, "500 M"]])}
        {pick("Writes per user per day", writes, setWrites, [[0.1, "0.1"], [1, "1"], [5, "5"], [20, "20"]])}
        {pick("Reads per write", ratio, setRatio, [[1, "1"], [10, "10"], [50, "50"], [100, "100"]])}
        {pick("Peak ÷ average", peak, setPeak, [[2, "2×"], [5, "5×"], [10, "10×"]])}
        {pick("Size of one item", size, setSize, [[100, "100 B"], [1000, "1 KB"], [10_000, "10 KB"], [1_000_000, "1 MB"]])}
        {pick("Keep for", years, setYears, [[1, "1 year"], [3, "3 years"], [5, "5 years"]])}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 }}>
        {out("Writes / s", `${round(wAvg)} → ${round(wAvg * peak)}`, "average → peak")}
        {out("Reads / s", `${round(rAvg)} → ${round(rAvg * peak)}`, "average → peak")}
        {out("Storage", bytes(storage), `${years} year${years > 1 ? "s" : ""}, before replication`)}
        {out("App servers", String(servers), "at 3k req/s each, 70% busy at peak")}
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--ink-3)" }}>A day has 86,400 seconds; round it to 10⁵ in your head and you&apos;ll be within 20%.</p>
    </div>
  );
}

/** How a cache's hit rate changes what reaches the database. */
export function CacheMath() {
  const [hit, setHit] = useState(90);
  const reads = 20_000;
  const misses = Math.round(reads * (1 - hit / 100));
  const replicas = Math.max(1, Math.ceil(misses / 7000));
  return (
    <div className="figure" data-interactive>
      <p className="fig-label">Try it · 20,000 redirects a second</p>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-2)", marginBottom: 10 }}>
        Cache hit rate
        <input type="range" min={0} max={99} value={hit} onChange={(e) => setHit(+e.target.value)} aria-label="Cache hit rate" />
        <span style={{ fontFamily: "var(--mono)" }}>{hit}%</span>
      </label>
      <div style={{ height: 14, borderRadius: 7, overflow: "hidden", display: "flex", marginBottom: 8, background: "var(--page-2)" }} aria-hidden="true">
        <span style={{ width: `${hit}%`, background: "var(--pass)" }} />
        <span style={{ width: `${100 - hit}%`, background: "var(--warn)" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
        <div style={{ background: "var(--pass-soft)", color: "var(--pass)", borderRadius: 8, padding: "8px 10px" }}>
          <strong style={{ fontWeight: 600 }}>From the cache</strong> · {(reads - misses).toLocaleString("en-US")} / s
          <div style={{ opacity: 0.85 }}>About 1 ms each</div>
        </div>
        <div style={{ background: "var(--warn-soft)", color: "var(--warn)", borderRadius: 8, padding: "8px 10px" }}>
          <strong style={{ fontWeight: 600 }}>To the database</strong> · <span data-testid="misses">{misses.toLocaleString("en-US")}</span> / s
          <div style={{ opacity: 0.85 }}>{replicas} database machine{replicas > 1 ? "s" : ""} at 10k reads/s, kept under 70%</div>
        </div>
      </div>
    </div>
  );
}

/** A small table that reads like part of the page. */
export function StepTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="figure" style={{ padding: 0, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
        <thead>
          <tr>{head.map((h) => <th key={h} scope="col" style={{ textAlign: "left", padding: "8px 12px", font: "500 12px var(--sans)", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)", borderBottom: "1px solid var(--rule)" }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]}>
              {r.map((c, i) => <td key={i} style={{ padding: "7px 12px", borderTop: "1px solid var(--rule)", verticalAlign: "top", fontWeight: i === 0 ? 500 : 400, whiteSpace: i === 1 ? "nowrap" : undefined, color: i === 2 ? "var(--ink-2)" : "var(--ink)" }}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A cache stampede: what one expiring hot key, or many keys expiring together, does to the database. */
export function StampedeLab() {
  const [rps, setRps] = useState(20_000);
  const [fetchMs, setFetchMs] = useState(200);
  const [coalesce, setCoalesce] = useState(false);
  const [jitter, setJitter] = useState(false);
  const hotQueries = coalesce ? 1 : Math.round((rps * fetchMs) / 1000);
  const keys = 10_000;
  const ttl = 300;
  const peakPerSec = jitter ? Math.round(keys / (ttl * 0.2)) : keys;
  const bar = (n: number, max: number) => `${Math.max(1, Math.min(100, (Math.log10(n + 1) / Math.log10(max + 1)) * 100))}%`;
  return (
    <div className="figure" data-interactive>
      <p className="fig-label">Try it · when cache entries expire</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
        <div>
          <strong style={{ display: "block", marginBottom: 6 }}>One hot key expires</strong>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-2)" }}>
            Requests/s <input type="range" min={1000} max={50000} step={1000} value={rps} onChange={(e) => setRps(+e.target.value)} aria-label="Requests per second on the hot key" /> <span style={{ fontFamily: "var(--mono)" }}>{rps.toLocaleString("en-US")}</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-2)" }}>
            Refill time <input type="range" min={20} max={500} step={10} value={fetchMs} onChange={(e) => setFetchMs(+e.target.value)} aria-label="Database refill time in ms" /> <span style={{ fontFamily: "var(--mono)" }}>{fetchMs} ms</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, margin: "6px 0" }}>
            <input type="checkbox" checked={coalesce} onChange={(e) => setCoalesce(e.target.checked)} /> Coalesce requests (one fetch, everyone waits for it)
          </label>
          <div style={{ height: 12, borderRadius: 6, background: "var(--page-2)", overflow: "hidden" }} aria-hidden="true">
            <span style={{ display: "block", height: "100%", width: bar(hotQueries, 50_000), background: coalesce ? "var(--pass)" : "var(--fail)" }} />
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 13.5 }} data-testid="hot-queries">
            <strong>{hotQueries.toLocaleString("en-US")}</strong> database {hotQueries === 1 ? "query" : "queries"} for one key
          </p>
        </div>
        <div>
          <strong style={{ display: "block", marginBottom: 6 }}>10,000 keys cached at the same moment</strong>
          <p style={{ margin: "0 0 6px", fontSize: 13, color: "var(--ink-2)" }}>All with a 5-minute TTL, say after a deploy warmed the cache.</p>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, margin: "6px 0" }}>
            <input type="checkbox" checked={jitter} onChange={(e) => setJitter(e.target.checked)} /> Add ±10% random jitter to each TTL
          </label>
          <div style={{ height: 12, borderRadius: 6, background: "var(--page-2)", overflow: "hidden" }} aria-hidden="true">
            <span style={{ display: "block", height: "100%", width: bar(peakPerSec, keys), background: jitter ? "var(--pass)" : "var(--fail)" }} />
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 13.5 }} data-testid="jitter-peak">
            Peak: <strong>{peakPerSec.toLocaleString("en-US")}</strong> refills {jitter ? "a second, spread over a minute" : "in the same second"}
          </p>
        </div>
      </div>
    </div>
  );
}

/** How many of one partner's calls get through when several gateways count them. */
export function GatewayCounts() {
  const [n, setN] = useState(6);
  const [mode, setMode] = useState<"local" | "central" | "sync">("local");
  const limit = 100;
  const sent = 300; // per minute, spread round robin
  const through = mode === "central" ? limit : mode === "sync" ? limit + Math.ceil((sent / 60) * 0.1) : Math.min(sent, limit * n);
  const labels = { local: "Each gateway counts alone", central: "One shared counter", sync: "Local, synced every 100 ms" };
  return (
    <div className="figure" data-interactive>
      <p className="fig-label">Try it · one partner, limit {limit} a minute, sending {sent}</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <div className="seg" role="group" aria-label="Where counts live">
          {(["local", "central", "sync"] as const).map((m) => (
            <button key={m} aria-pressed={mode === m} onClick={() => setMode(m)}>{labels[m]}</button>
          ))}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-2)" }}>
          Gateways <input type="range" min={1} max={10} value={n} onChange={(e) => setN(+e.target.value)} aria-label="Number of gateways" /> <span style={{ fontFamily: "var(--mono)" }}>{n}</span>
        </label>
      </div>
      <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 72, marginBottom: 6 }} aria-hidden="true">
        {Array.from({ length: n }, (_, i) => {
          const sees = sent / n;
          const allows = mode === "local" ? Math.min(sees, limit) : through / n;
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
              <span style={{ height: `${(Math.max(0, sees - allows) / sent) * 100 * 2}%`, background: "var(--fail-soft)", borderRadius: "4px 4px 0 0" }} />
              <span style={{ height: `${(allows / sent) * 100 * 2}%`, background: "var(--accent)" }} />
            </div>
          );
        })}
      </div>
      <p style={{ margin: 0, fontSize: 13.5 }} data-testid="gateway-through">
        <strong style={{ color: through > limit * 1.1 ? "var(--fail)" : "var(--pass)" }}>{through}</strong> of {sent} calls get through
        {through > limit * 1.1 ? `: ${(through / limit).toFixed(1)}× the limit` : mode === "sync" ? ": within one sync interval of the limit" : ": exactly the limit"}.
      </p>
    </div>
  );
}

/** A provider outage under three retry policies: what's lost, what the provider sees, how long recovery takes. */
export function RetryLab() {
  const [minutes, setMinutes] = useState(5);
  const [policy, setPolicy] = useState<"none" | "immediate" | "backoff">("backoff");
  const rate = 20_000;
  const workers = 30_000; // total send capacity
  const backlog = rate * minutes * 60;
  const lost = policy === "none" ? backlog : 0;
  const pressure = policy === "immediate" ? workers : policy === "backoff" ? Math.round(workers * 0.05) : 0; // requests/s at the provider while it's down
  const drainMin = policy === "none" ? 0 : backlog / (workers - rate) / 60;
  const row = (label: string, value: string, bad: boolean, testid: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderTop: "1px solid var(--rule)" }}>
      <span>{label}</span>
      <strong data-testid={testid} style={{ color: bad ? "var(--fail)" : "var(--pass)", fontVariantNumeric: "tabular-nums" }}>{value}</strong>
    </div>
  );
  return (
    <div className="figure" data-interactive>
      <p className="fig-label">Try it · the push provider goes down at dinner peak</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <div className="seg" role="group" aria-label="Retry policy">
          {([["none", "Drop failures"], ["immediate", "Retry at once"], ["backoff", "Backoff + jitter"]] as const).map(([v, l]) => (
            <button key={v} aria-pressed={policy === v} onClick={() => setPolicy(v)}>{l}</button>
          ))}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-2)" }}>
          Outage <input type="range" min={1} max={15} value={minutes} onChange={(e) => setMinutes(+e.target.value)} aria-label="Outage length in minutes" /> <span style={{ fontFamily: "var(--mono)" }}>{minutes} min</span>
        </label>
      </div>
      <div style={{ fontSize: 13.5 }}>
        {row("Notifications lost", lost.toLocaleString("en-US"), lost > 0, "retry-lost")}
        {row("Sends hitting the provider while it's down", `${pressure.toLocaleString("en-US")} / s`, pressure > 5000, "retry-pressure")}
        {row("Time to clear the backlog afterwards", policy === "none" ? "nothing to clear (it's gone)" : `${Math.round(drainMin)} min`, policy === "none", "retry-drain")}
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--ink-3)" }}>{rate.toLocaleString("en-US")} notifications a second arrive; workers can send {workers.toLocaleString("en-US")} a second in total. Estimates, rounded.</p>
    </div>
  );
}

/** What one post costs under each fan-out strategy, as the author's follower count grows. */
export function FanoutCost() {
  const steps = [100, 1_000, 10_000, 100_000, 1_000_000, 20_000_000];
  const [i, setI] = useState(1);
  const [strategy, setStrategy] = useState<"push" | "pull" | "hybrid">("push");
  const followers = steps[i];
  const threshold = 100_000;
  const pushes = strategy === "push" || (strategy === "hybrid" && followers < threshold);
  const inserts = pushes ? followers : 0;
  const spare = 400_000; // feed inserts per second the fan-out tier can spare
  const seconds = inserts / spare;
  const extraReads = strategy === "pull" ? 300 : strategy === "hybrid" ? 5 : 0;
  const fmt = (n: number) => (n >= 1e6 ? `${n / 1e6} million` : n.toLocaleString("en-US"));
  return (
    <div className="figure" data-interactive>
      <p className="fig-label">Try it · the cost of one post</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <div className="seg" role="group" aria-label="Fan-out strategy">
          {([["push", "On write"], ["pull", "On read"], ["hybrid", "Hybrid"]] as const).map(([v, l]) => (
            <button key={v} aria-pressed={strategy === v} onClick={() => setStrategy(v)}>{l}</button>
          ))}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-2)" }}>
          Author&apos;s followers <input type="range" min={0} max={steps.length - 1} value={i} onChange={(e) => setI(+e.target.value)} aria-label="Author's followers" aria-valuetext={fmt(followers)} /> <span style={{ fontFamily: "var(--mono)" }}>{fmt(followers)}</span>
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, fontSize: 13 }}>
        <div style={{ background: "var(--page-2)", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ color: "var(--ink-3)", fontSize: 12 }}>Feed inserts for this post</div>
          <strong style={{ fontSize: 16 }} data-testid="fan-inserts">{fmt(inserts)}</strong>
        </div>
        <div style={{ background: seconds > 5 ? "var(--fail-soft)" : "var(--page-2)", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ color: "var(--ink-3)", fontSize: 12 }}>Time to reach every feed</div>
          <strong style={{ fontSize: 16, color: seconds > 5 ? "var(--fail)" : "var(--ink)" }} data-testid="fan-time">{inserts ? (seconds < 1 ? "under a second" : `about ${Math.round(seconds)} s`) : "at read time"}</strong>
        </div>
        <div style={{ background: extraReads > 50 ? "var(--fail-soft)" : "var(--page-2)", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ color: "var(--ink-3)", fontSize: 12 }}>Extra reads on every feed load</div>
          <strong style={{ fontSize: 16, color: extraReads > 50 ? "var(--fail)" : "var(--ink)" }} data-testid="fan-reads">{extraReads}</strong>
        </div>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--ink-3)" }}>Hybrid pushes for authors under 100,000 followers and pulls the rest in at read time. Estimates, rounded.</p>
    </div>
  );
}
