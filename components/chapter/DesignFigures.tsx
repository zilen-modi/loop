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

/** A waiting room in numbers: the admission rate against database load, wait times and the sell-out. */
export function WaitingRoom() {
  const [on, setOn] = useState(true);
  const [admit, setAdmit] = useState(1000);
  const [place, setPlace] = useState(30_000);
  const writes = 3000; // the seat database's writes per second
  const perFan = 1.8; // one hold write, and 4 in 5 fans also write a booking
  const attempts = on ? admit : 90_000; // with no line, 30,000 fans a second retry ~3 times
  const db = (attempts * perFan) / writes;
  const waitS = place / admit;
  const sellOutS = 40_000 / 0.8 / admit; // 40,000 orders; 1 hold in 5 lapses and goes back
  const tooLate = place > admit * sellOutS; // admitted after the last pass is gone
  const fmtTime = (s: number) => (s < 90 ? `${Math.round(s)} s` : s < 5400 ? `${Math.round(s / 60)} min` : `${(s / 3600).toFixed(1)} h`);
  const tile = (label: string, value: string, bad: boolean, id: string) => (
    <div style={{ background: bad ? "var(--fail-soft)" : "var(--page-2)", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ color: "var(--ink-3)", fontSize: 12 }}>{label}</div>
      <strong style={{ fontSize: 16, color: bad ? "var(--fail)" : "var(--ink)" }} data-testid={id}>{value}</strong>
    </div>
  );
  return (
    <div className="figure" data-interactive>
      <p className="fig-label">Try it · the line in numbers</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <div className="seg" role="group" aria-label="Waiting room">
          <button aria-pressed={!on} onClick={() => setOn(false)}>No line</button>
          <button aria-pressed={on} onClick={() => setOn(true)}>Waiting room</button>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: on ? "var(--ink-2)" : "var(--ink-3)" }}>
          Admit per second <input type="range" min={250} max={3000} step={250} value={admit} disabled={!on} onChange={(e) => setAdmit(+e.target.value)} aria-label="Fans admitted per second" aria-valuetext={`${admit} a second`} /> <span style={{ fontFamily: "var(--mono)" }}>{admit.toLocaleString("en-US")}</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: on ? "var(--ink-2)" : "var(--ink-3)" }}>
          Your place <input type="range" min={10_000} max={600_000} step={10_000} value={place} disabled={!on} onChange={(e) => setPlace(+e.target.value)} aria-label="Your place in line" aria-valuetext={`number ${place.toLocaleString("en-US")}`} /> <span style={{ fontFamily: "var(--mono)" }}>#{place.toLocaleString("en-US")}</span>
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, fontSize: 13 }}>
        {tile("Attempts reaching the app", `${attempts.toLocaleString("en-US")} / s`, !on, "wr-attempts")}
        {tile("Seat database busy", db >= 1 ? "overloaded" : `${Math.round(db * 100)}%`, db > 0.7, "wr-db")}
        {tile("Your wait", !on ? "a race of retries" : tooLate ? "sold out before your turn" : `about ${fmtTime(waitS)}`, !on || tooLate, "wr-wait")}
        {tile("Sold out after", on ? `about ${fmtTime(sellOutS)}` : "whenever the database recovers", !on, "wr-sellout")}
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--ink-3)" }}>One SQL primary at 3,000 writes a second; each admitted fan makes 1.8 writes on average. 40,000 orders, and 1 hold in 5 lapses and is sold again. Estimates, rounded.</p>
    </div>
  );
}

/** How a message finds its recipient's connection, and what each way costs as gateways are added. */
export function DeliveryPaths() {
  const [how, setHow] = useState<"registry" | "broadcast" | "poll">("registry");
  const [gateways, setGateways] = useState(29);
  const sends = 40_000;
  const deliveries = 48_000; // online recipients: 1.5 per message, 80% online
  const heartbeats = 66_667; // 2 million clients, every 30 s
  const capacity = 20_000; // messages a second one gateway handles
  const perGateway = how === "registry" ? (sends + deliveries + heartbeats) / gateways : how === "broadcast" ? sends * 1.5 + (sends + heartbeats) / gateways : heartbeats / gateways;
  const busy = perGateway / capacity;
  const reads = how === "poll" ? 1_000_000 : 0;
  const delay = how === "poll" ? "about 1,000 ms" : busy >= 1 ? "never: overloaded" : "about 40 ms";
  const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
  const tile = (label: string, value: string, bad: boolean, id: string) => (
    <div style={{ background: bad ? "var(--fail-soft)" : "var(--page-2)", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ color: "var(--ink-3)", fontSize: 12 }}>{label}</div>
      <strong style={{ fontSize: 16, color: bad ? "var(--fail)" : "var(--ink)" }} data-testid={id}>{value}</strong>
    </div>
  );
  return (
    <div className="figure" data-interactive>
      <p className="fig-label">Try it · finding the right connection</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <div className="seg" role="group" aria-label="Delivery">
          {([["registry", "Registry"], ["broadcast", "Broadcast"], ["poll", "Polling"]] as const).map(([v, l]) => (
            <button key={v} aria-pressed={how === v} onClick={() => setHow(v)}>{l}</button>
          ))}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-2)" }}>
          Gateways <input type="range" min={5} max={60} value={gateways} onChange={(e) => setGateways(+e.target.value)} aria-label="Number of gateways" aria-valuetext={`${gateways} gateways`} /> <span style={{ fontFamily: "var(--mono)" }}>{gateways}</span>
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, fontSize: 13 }}>
        {tile("Messages per gateway", `${fmt(perGateway)} / s`, busy > 0.7, "dp-each")}
        {tile("Gateway busy", busy >= 1 ? "overloaded" : `${Math.round(busy * 100)}%`, busy > 0.7, "dp-busy")}
        {tile("Store reads for delivery", reads ? `${fmt(reads)} / s` : "none", reads > 0, "dp-reads")}
        {tile("Delivery delay", delay, how === "poll" || busy >= 1, "dp-delay")}
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--ink-3)" }}>40,000 messages a second, 1.5 recipients each, 80% online; 2 million clients sending a heartbeat every 30 s; 20,000 messages a second per gateway. With broadcast, every gateway handles every delivery, however many there are. Estimates, rounded.</p>
    </div>
  );
}

type LedgerAccount = "Customer" | "Tiffin" | "Restaurant";
const ledgerAccounts: LedgerAccount[] = ["Customer", "Tiffin", "Restaurant"];

/** The same money movements as a ledger and as balance columns, including two refunds that race. */
export function LedgerLab() {
  const [entries, setEntries] = useState<{ acct: LedgerAccount; amount: number; what: string }[]>([]);
  const [column, setColumn] = useState<Record<LedgerAccount, number>>({ Customer: 0, Tiffin: 0, Restaurant: 0 });
  const [line, setLine] = useState("Nothing has happened yet.");
  const move = (from: LedgerAccount, to: LedgerAccount, amount: number, what: string) => [
    { acct: from, amount: -amount, what },
    { acct: to, amount, what },
  ];
  const pay = () => {
    setEntries([...entries, ...move("Customer", "Tiffin", 500, "Order paid")]);
    setColumn({ ...column, Customer: column.Customer - 500, Tiffin: column.Tiffin + 500 });
    setLine("Order paid: Customer −₹500, Tiffin +₹500. Both views agree.");
  };
  const payout = () => {
    setEntries([...entries, ...move("Tiffin", "Restaurant", 350, "Payout")]);
    setColumn({ ...column, Tiffin: column.Tiffin - 350, Restaurant: column.Restaurant + 350 });
    setLine("Payout: Tiffin −₹350, Restaurant +₹350. Both views agree.");
  };
  const raceRefunds = () => {
    // Ledger: two refunds append four entries. Balance columns: both refunds read the same old values,
    // and the second write overwrites the first.
    setEntries([...entries, ...move("Tiffin", "Customer", 50, "Refund A"), ...move("Tiffin", "Customer", 50, "Refund B")]);
    setColumn({ ...column, Tiffin: column.Tiffin - 50, Customer: column.Customer + 50 });
    setLine("Two ₹50 refunds at the same moment. The ledger appends both. The balance columns both read the old value and write old ± ₹50, so one refund disappears.");
  };
  const sum = (a: LedgerAccount) => entries.filter((e) => e.acct === a).reduce((t, e) => t + e.amount, 0);
  const total = entries.reduce((t, e) => t + e.amount, 0);
  const rupees = (n: number) => `${n < 0 ? "−" : ""}₹${Math.abs(n).toLocaleString("en-IN")}`;
  return (
    <div className="figure" data-interactive>
      <p className="fig-label">Try it · ledger or balance column</p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <button className="btn small" onClick={pay}>Order paid ₹500</button>
        <button className="btn small" onClick={payout}>Pay restaurant ₹350</button>
        <button className="btn small" onClick={raceRefunds}>Two ₹50 refunds at once</button>
        <button className="btn small" onClick={() => { setEntries([]); setColumn({ Customer: 0, Tiffin: 0, Restaurant: 0 }); setLine("Back to the start."); }} aria-label="Reset the ledger">↺</button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ color: "var(--ink-3)", textAlign: "left" }}>
              <th style={{ padding: "4px 6px", fontWeight: 500 }}>Account</th>
              <th style={{ padding: "4px 6px", fontWeight: 500 }}>Ledger (sum of entries)</th>
              <th style={{ padding: "4px 6px", fontWeight: 500 }}>Balance column</th>
            </tr>
          </thead>
          <tbody>
            {ledgerAccounts.map((a) => {
              const off = sum(a) !== column[a];
              return (
                <tr key={a} style={{ borderTop: "1px solid var(--rule)" }}>
                  <td style={{ padding: "6px" }}>{a}</td>
                  <td style={{ padding: "6px", fontFamily: "var(--mono)" }} data-testid={`ledger-${a}`}>{rupees(sum(a))}</td>
                  <td style={{ padding: "6px", fontFamily: "var(--mono)", color: off ? "var(--fail)" : "var(--ink)" }} data-testid={`column-${a}`}>{rupees(column[a])}{off ? " ✗" : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ margin: "8px 0 4px", fontSize: 13 }}>
        {entries.length} ledger entries; their sum is <strong data-testid="ledger-total">{rupees(total)}</strong>.
      </p>
      <p role="status" style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)" }} data-testid="ledger-line">{line}</p>
    </div>
  );
}
