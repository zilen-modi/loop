"use client";

import { useState } from "react";
import { Bike, Car, RotateCcw, Truck } from "lucide-react";

// Interactive figures for the LLD build chapters.

const SIZES = ["bike", "car", "truck"] as const;
type Size = (typeof SIZES)[number];
const ICON = { bike: Bike, car: Car, truck: Truck };
const FLOORS: [string, Partial<Record<Size, number>>][] = [
  ["G", { bike: 2, car: 3, truck: 1 }],
  ["L1", { car: 3, truck: 1 }],
];
type Slot = { id: string; floor: string; size: Size; by: Size | null };
const fresh = (): Slot[] =>
  FLOORS.flatMap(([floor, spec]) => SIZES.flatMap((size) => Array.from({ length: spec[size] ?? 0 }, (_, i) => ({ id: `${floor}-${size[0].toUpperCase()}${i + 1}`, floor, size, by: null }))));

/** The allocation rule, live: send vehicles in and see which slot each one gets, and why. */
export function ParkingBoard() {
  const [slots, setSlots] = useState<Slot[]>(fresh);
  const [line, setLine] = useState("Send a vehicle in. Click a parked one to let it leave.");
  function arrive(type: Size) {
    const sizes = SIZES.slice(SIZES.indexOf(type));
    for (const size of sizes) {
      const s = slots.find((x) => !x.by && x.size === size);
      if (!s) continue;
      const why =
        size !== type
          ? `no ${type} slot is free, so the next size up`
          : s.floor !== FLOORS[0][0]
            ? `no ${type} slot is free on ${FLOORS[0][0]}, so the next floor`
            : `its own size, on the first floor, lowest number`;
      setSlots(slots.map((x) => (x.id === s.id ? { ...x, by: type } : x)));
      setLine(`${type[0].toUpperCase() + type.slice(1)} → ${s.id}: ${why}.`);
      return;
    }
    setLine(`${type[0].toUpperCase() + type.slice(1)} turned away: no ${sizes.join(" or ")} slot is free.`);
  }
  return (
    <div className="figure" data-interactive>
      <p className="fig-label">Try it · own size first, then floors in order</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {SIZES.map((t) => {
          const Icon = ICON[t];
          return (
            <button key={t} className="btn small" onClick={() => arrive(t)}>
              <Icon size={15} aria-hidden="true" /> {t[0].toUpperCase() + t.slice(1)} arrives
            </button>
          );
        })}
        <button className="btn small" onClick={() => { setSlots(fresh()); setLine("Empty again."); }} aria-label="Empty the car park"><RotateCcw size={14} /></button>
      </div>
      {FLOORS.map(([floor]) => (
        <div key={floor} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span className="kicker" style={{ width: 24, margin: 0 }}>{floor}</span>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {slots.filter((s) => s.floor === floor).map((s) => {
              const Icon = s.by ? ICON[s.by] : null;
              return (
                <button
                  key={s.id}
                  onClick={() => { if (s.by) { setSlots(slots.map((x) => (x.id === s.id ? { ...x, by: null } : x))); setLine(`${s.id} is free again.`); } }}
                  aria-label={`${s.id}, ${s.size} slot, ${s.by ? `taken by a ${s.by}` : "free"}`}
                  data-slot={s.id}
                  style={{
                    width: s.size === "truck" ? 76 : s.size === "car" ? 58 : 44,
                    height: 44,
                    borderRadius: 7,
                    border: `1.5px ${s.by ? "solid var(--accent)" : "dashed var(--rule-2)"}`,
                    background: s.by ? "var(--accent-soft)" : "transparent",
                    color: s.by ? "var(--accent)" : "var(--ink-3)",
                    font: "500 12px var(--sans)",
                    display: "grid",
                    placeItems: "center",
                    cursor: s.by ? "pointer" : "default",
                  }}
                >
                  {Icon ? <Icon size={16} aria-hidden="true" /> : s.id.split("-")[1]}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p role="status" style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--ink-2)" }} data-testid="parking-line">{line}</p>
    </div>
  );
}

type Entry = { key: string; uses: number };

/** Use menus and watch which one each policy drops: LRU remembers when, LFU remembers how often. */
export function EvictionLab() {
  const [policy, setPolicy] = useState<"lru" | "lfu">("lru");
  const [items, setItems] = useState<Entry[]>([]); // least to most recently used
  const [line, setLine] = useState("Capacity 3. Use menus and watch what gets dropped.");
  function use(key: string) {
    const hit = items.find((e) => e.key === key);
    let next = items.filter((e) => e.key !== key);
    let msg = hit ? `${key} is a hit: now the most recent, ${hit.uses + 1} uses.` : `${key} is a miss: added.`;
    if (!hit && next.length >= 3) {
      const victim = policy === "lru" ? next[0] : next.reduce((best, e) => (e.uses < best.uses ? e : best), next[0]);
      next = next.filter((e) => e !== victim);
      msg = `${key} is a miss and the cache is full: ${victim.key} is dropped (${policy === "lru" ? "least recently used" : `fewest uses (${victim.uses})${next.some((e) => e.uses === victim.uses) ? ", and older than the others with as few" : ""}`}).`;
    }
    setItems([...next, { key, uses: (hit?.uses ?? 0) + 1 }]);
    setLine(msg);
  }
  return (
    <div className="figure" data-interactive>
      <p className="fig-label">Try it · a cache of 3 menus</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <div className="seg" role="group" aria-label="Eviction policy">
          {(["lru", "lfu"] as const).map((p) => (
            <button key={p} aria-pressed={policy === p} onClick={() => { setPolicy(p); setItems([]); setLine(`${p.toUpperCase()}: empty again.`); }}>{p.toUpperCase()}</button>
          ))}
        </div>
        {["A", "B", "C", "D", "E"].map((k) => (
          <button key={k} className="btn small" onClick={() => use(k)} aria-label={`Use menu ${k}`}>{k}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", minHeight: 52 }} aria-label="Cache contents, oldest use first">
        <span className="kicker" style={{ margin: 0, width: 54 }}>oldest</span>
        {items.map((e, i) => (
          <span key={e.key} data-entry={e.key} style={{ display: "grid", placeItems: "center", width: 52, height: 48, borderRadius: 8, border: "1.5px solid var(--accent)", background: i === items.length - 1 ? "var(--accent-soft)" : "transparent", font: "600 15px var(--sans)" }}>
            {e.key}
            <span style={{ font: "400 12px var(--sans)", color: "var(--ink-3)" }}>{e.uses}×</span>
          </span>
        ))}
        {Array.from({ length: 3 - items.length }, (_, i) => (
          <span key={`empty${i}`} style={{ width: 52, height: 48, borderRadius: 8, border: "1.5px dashed var(--rule-2)" }} aria-hidden="true" />
        ))}
        <span className="kicker" style={{ margin: 0 }}>newest</span>
      </div>
      <p role="status" style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--ink-2)" }} data-testid="cache-line">{line}</p>
    </div>
  );
}

/** A token bucket on a simulated clock: send requests, let time pass, change the capacity and rate. */
export function TokenBucketLab() {
  const [capacity, setCapacity] = useState(4);
  const [rate, setRate] = useState(2);
  const [milli, setMilli] = useState(4000); // thousandths of a token
  const [clock, setClock] = useState(0);
  const [log, setLog] = useState<{ t: number; ok: boolean }[]>([]);
  const send = (n: number) => {
    let m = milli;
    const out: { t: number; ok: boolean }[] = [];
    for (let i = 0; i < n; i++) {
      const ok = m >= 1000;
      if (ok) m -= 1000;
      out.push({ t: clock, ok });
    }
    setMilli(m);
    setLog([...out.reverse(), ...log].slice(0, 8));
  };
  const wait = (ms: number) => {
    setMilli(Math.min(capacity * 1000, milli + ms * rate));
    setClock(clock + ms);
  };
  const reset = (c: number, r: number) => {
    setCapacity(c);
    setRate(r);
    setMilli(c * 1000);
    setClock(0);
    setLog([]);
  };
  const tokens = milli / 1000;
  return (
    <div className="figure" data-interactive>
      <p className="fig-label">Try it · a token bucket, {capacity} tokens, {rate} per second</p>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center", marginBottom: 10, fontSize: 13, color: "var(--ink-2)" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Capacity <input type="range" min={1} max={8} value={capacity} onChange={(e) => reset(+e.target.value, rate)} aria-label="Capacity" /> <span style={{ fontFamily: "var(--mono)" }}>{capacity}</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Refill <input type="range" min={1} max={5} value={rate} onChange={(e) => reset(capacity, +e.target.value)} aria-label="Refill per second" /> <span style={{ fontFamily: "var(--mono)" }}>{rate}/s</span>
        </label>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }} role="img" aria-label={`${tokens.toFixed(2)} of ${capacity} tokens`}>
        {Array.from({ length: capacity }, (_, i) => {
          const fill = Math.max(0, Math.min(1, tokens - i));
          return (
            <span key={i} style={{ flex: 1, height: 26, borderRadius: 6, border: "1.5px solid var(--accent)", background: `linear-gradient(to right, var(--accent-soft) ${fill * 100}%, transparent ${fill * 100}%)` }} />
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
        <button className="btn small" onClick={() => send(1)}>Send 1 request</button>
        <button className="btn small" onClick={() => send(5)}>Send a burst of 5</button>
        <button className="btn small" onClick={() => wait(250)}>Wait 250 ms</button>
        <button className="btn small" onClick={() => wait(1000)}>Wait 1 s</button>
        <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 13 }} data-testid="bucket-state">t = {clock} ms · {tokens.toFixed(2)} tokens</span>
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", minHeight: 26 }} aria-label="Recent requests, newest first">
        {log.map((x, i) => (
          <span key={i} className={`chip ${x.ok ? "easy" : "hard"}`}>{x.ok ? "allowed" : "refused"} @ {x.t}</span>
        ))}
      </div>
    </div>
  );
}
