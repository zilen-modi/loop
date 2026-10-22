"use client";

import { Fragment, useState } from "react";
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

type TxOp = { label: string; run: (s: TxState) => TxState | string };
type TxState = { store: Record<string, number>; logs: [string, number | null][][] };

/** Nested transactions as an undo log you can watch: each open transaction remembers what it overwrote. */
export function TransactionLab() {
  const [s, setS] = useState<TxState>({ store: { price: 100 }, logs: [] });
  const [line, setLine] = useState("price is 100. Open a transaction and change it.");
  const set = (v: number): TxOp => ({
    label: `price = ${v}`,
    run: (st) => {
      const logs = st.logs.map((l) => [...l]);
      if (logs.length) logs[logs.length - 1].push(["price", st.store.price ?? null]);
      return { store: { ...st.store, price: v }, logs };
    },
  });
  const ops: TxOp[] = [
    { label: "begin", run: (st) => ({ ...st, logs: [...st.logs, []] }) },
    set(120),
    set(150),
    {
      label: "commit",
      run: (st) => {
        if (!st.logs.length) return "No open transaction to commit.";
        const logs = st.logs.map((l) => [...l]);
        const inner = logs.pop()!;
        if (logs.length) logs[logs.length - 1].push(...inner);
        return { ...st, logs };
      },
    },
    {
      label: "rollback",
      run: (st) => {
        if (!st.logs.length) return "No open transaction to roll back.";
        const logs = st.logs.map((l) => [...l]);
        const inner = logs.pop()!;
        const store = { ...st.store };
        for (let i = inner.length - 1; i >= 0; i--) {
          const [k, prev] = inner[i];
          if (prev === null) delete store[k];
          else store[k] = prev;
        }
        return { store, logs };
      },
    },
  ];
  return (
    <div className="figure" data-interactive>
      <p className="fig-label">Try it · undo logs for nested transactions</p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {ops.map((op) => (
          <button
            key={op.label}
            className="btn small"
            onClick={() => {
              const next = op.run(s);
              if (typeof next === "string") return setLine(next);
              setS(next);
              setLine(`${op.label} → price is ${next.store.price ?? "gone"}, ${next.logs.length} transaction${next.logs.length === 1 ? "" : "s"} open.`);
            }}
          >
            {op.label}
          </button>
        ))}
        <button className="btn small" onClick={() => { setS({ store: { price: 100 }, logs: [] }); setLine("Reset: price is 100."); }} aria-label="Reset the store">↺</button>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="kicker" style={{ margin: 0, width: 92 }}>Store</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 14 }} data-testid="tx-store">price = {s.store.price ?? "(gone)"}</span>
        </div>
        {s.logs.map((log, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", paddingLeft: i * 14 }}>
            <span className="kicker" style={{ margin: 0, width: 92 - i * 14 }}>Undo log {i + 1}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink-2)" }}>
              {log.length ? log.map(([k, v]) => `${k} was ${v ?? "unset"}`).join(" · ") : "(nothing changed yet)"}
            </span>
          </div>
        ))}
      </div>
      <p role="status" style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--ink-2)" }} data-testid="tx-line">{line}</p>
    </div>
  );
}

type VmState = "idle" | "has-money" | "maintenance";

/** The vending machine as a state machine: try actions and see which states allow them. */
export function VendingStateLab() {
  const [state, setState] = useState<VmState>("idle");
  const [balance, setBalance] = useState(0);
  const [stock, setStock] = useState(2);
  const [line, setLine] = useState("Idle. Try an action.");
  const allowed: Record<string, VmState[]> = {
    "Insert ₹10": ["idle", "has-money"],
    "Buy chips (₹10)": ["idle", "has-money"],
    Refund: ["idle", "has-money"],
    Restock: ["idle", "maintenance"],
    "Start maintenance": ["idle"],
    "End maintenance": ["maintenance"],
  };
  const act = (name: string) => {
    if (!allowed[name].includes(state)) return setLine(`${name}: not allowed while ${state}.`);
    if (name === "Insert ₹10") { setBalance(balance + 10); setState("has-money"); return setLine(`Balance ₹${balance + 10}. Now has-money.`); }
    if (name === "Buy chips (₹10)") {
      if (stock === 0) return setLine("Sold out: the sale is refused and nothing changes.");
      if (balance < 10) return setLine("Not enough money: the sale is refused and nothing changes.");
      setStock(stock - 1); setBalance(0); setState("idle");
      return setLine(`Sold!${balance > 10 ? ` Change: ₹${balance - 10}.` : ""} Back to idle.`);
    }
    if (name === "Refund") { setLine(balance ? `Refunded your ₹${balance}. Back to idle.` : "Nothing to refund."); setBalance(0); return setState("idle"); }
    if (name === "Restock") { setStock(stock + 3); return setLine(`Restocked: ${stock + 3} chips.`); }
    if (name === "Start maintenance") { setState("maintenance"); return setLine("Maintenance: customers can't use the machine."); }
    setState("idle"); setLine("Back to idle.");
  };
  const states: VmState[] = ["idle", "has-money", "maintenance"];
  return (
    <div className="figure" data-interactive>
      <p className="fig-label">Try it · what each state allows</p>
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }} aria-label="States">
        {states.map((s) => (
          <span key={s} data-vm-state={s} aria-current={state === s ? "true" : undefined} style={{ padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${state === s ? "var(--accent)" : "var(--rule-2)"}`, background: state === s ? "var(--accent-soft)" : "transparent", font: "500 13px var(--sans)" }}>
            {s}
          </span>
        ))}
        <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 13, alignSelf: "center" }}>₹{balance} in · {stock} chips</span>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {Object.keys(allowed).map((a) => (
          <button key={a} className="btn small" onClick={() => act(a)} style={{ opacity: allowed[a].includes(state) ? 1 : 0.55 }}>{a}</button>
        ))}
      </div>
      <p role="status" style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)" }} data-testid="vm-line">{line}</p>
    </div>
  );
}

/** Two people race for the same seats; holds are all or nothing and expire after 10 minutes. */
export function SeatRace() {
  const seats = ["D4", "D5", "D6", "D7", "D8"];
  const [clock, setClock] = useState(0); // minutes after midnight
  const [holds, setHolds] = useState<{ who: string; seats: string[]; at: number; paid: boolean }[]>([]);
  const [line, setLine] = useState("Bookings open at midnight. Try the race.");
  const live = (h: { at: number; paid: boolean }) => h.paid || clock < h.at + 10;
  const owner = (s: string) => holds.find((h) => h.seats.includes(s) && live(h));
  const hold = (who: string, want: string[]) => {
    const taken = want.filter((s) => owner(s));
    if (taken.length) return setLine(`${who} asks for ${want.join(" + ")}: refused, because ${taken.join(", ")} ${taken.length > 1 ? "are" : "is"} taken. Nothing is held.`);
    setHolds([...holds, { who, seats: want, at: clock, paid: false }]); // expired holds stay, so a late payment can say why it failed
    setLine(`${who} holds ${want.join(" + ")} until 00:${String(clock + 10).padStart(2, "0")}.`);
  };
  const pay = (who: string) => {
    const h = [...holds].reverse().find((x) => x.who === who && !x.paid);
    if (!h) return setLine(`${who} has no hold to pay for.`);
    if (!live(h)) return setLine(`${who}'s hold expired at 00:${String(h.at + 10).padStart(2, "0")}: payment refused, seats already free.`);
    setHolds(holds.map((x) => (x === h ? { ...x, paid: true } : x)));
    setLine(`${who} paid: ${h.seats.join(" + ")} booked.`);
  };
  return (
    <div className="figure" data-interactive>
      <p className="fig-label">Try it · midnight, row D</p>
      <div style={{ display: "flex", gap: 4, marginBottom: 10, alignItems: "center" }}>
        {seats.map((s) => {
          const o = owner(s);
          return (
            <span key={s} data-seat={s} style={{ width: 52, height: 44, display: "grid", placeItems: "center", borderRadius: 8, font: "500 12px var(--sans)", border: `1.5px ${o ? "solid" : "dashed"} ${o ? (o.paid ? "var(--ink-2)" : "var(--accent)") : "var(--rule-2)"}`, background: o ? (o.paid ? "var(--page-2)" : "var(--accent-soft)") : "transparent" }}>
              {s}
              <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{o ? (o.paid ? `${o.who[0]} ✓` : o.who[0]) : "free"}</span>
            </span>
          );
        })}
        <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 13 }} data-testid="race-clock">00:{String(clock).padStart(2, "0")}</span>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        <button className="btn small" onClick={() => hold("Asha", ["D5", "D6"])}>Asha holds D5 + D6</button>
        <button className="btn small" onClick={() => hold("Bilal", ["D6", "D7"])}>Bilal holds D6 + D7</button>
        <button className="btn small" onClick={() => pay("Asha")}>Asha pays</button>
        <button className="btn small" onClick={() => pay("Bilal")}>Bilal pays</button>
        <button className="btn small" onClick={() => setClock(clock + 5)}>Wait 5 minutes</button>
        <button className="btn small" onClick={() => { setClock(0); setHolds([]); setLine("Reset to midnight."); }} aria-label="Reset the race">↺</button>
      </div>
      <p role="status" style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)" }} data-testid="race-line">{line}</p>
    </div>
  );
}

/** One lift running SCAN: add stops, step time, and watch it sweep up and down. */
export function ScanLift() {
  const floors = 10;
  const [floor, setFloor] = useState(4);
  const [dir, setDir] = useState<"up" | "down" | "idle">("idle");
  const [stops, setStops] = useState<number[]>([]);
  const [log, setLog] = useState<number[]>([]);
  const step = () => {
    if (!stops.length) return;
    if (stops.includes(floor)) {
      setStops(stops.filter((s) => s !== floor));
      setLog([...log, floor]);
      if (stops.length === 1) setDir("idle");
      return;
    }
    const ahead = (d: string) => stops.some((s) => (d === "up" ? s > floor : s < floor));
    let d = dir;
    if (d === "idle" || !ahead(d)) {
      if (d !== "idle" && ahead(d === "up" ? "down" : "up")) d = d === "up" ? "down" : "up";
      else if (d === "idle") {
        const near = [...stops].sort((a, b) => Math.abs(a - floor) - Math.abs(b - floor) || b - a)[0];
        d = near > floor ? "up" : "down";
      }
    }
    const next = floor + (d === "up" ? 1 : -1);
    setDir(d);
    setFloor(next);
    if (stops.includes(next)) {
      const rest = stops.filter((s) => s !== next);
      setStops(rest);
      setLog([...log, next]);
      if (!rest.length) setDir("idle");
    }
  };
  return (
    <div className="figure" data-interactive>
      <p className="fig-label">Try it · one lift, SCAN</p>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 3 }} aria-label="Floors, top first">
          {Array.from({ length: floors }, (_, i) => floors - 1 - i).map((f) => (
            <button
              key={f}
              onClick={() => !stops.includes(f) && setStops([...stops, f])}
              aria-label={`Floor ${f}${f === floor ? ", the lift is here" : ""}${stops.includes(f) ? ", a stop" : ""}`}
              data-floor={f}
              style={{ width: 120, height: 40, display: "flex", alignItems: "center", gap: 8, padding: "0 10px", borderRadius: 7, border: `1.5px solid ${stops.includes(f) ? "var(--accent)" : "var(--rule)"}`, background: f === floor ? "var(--accent-soft)" : "transparent", font: "500 13px var(--sans)", color: "var(--ink)", cursor: "pointer" }}
            >
              <span style={{ width: 20, color: "var(--ink-3)" }}>{f}</span>
              {f === floor && <span aria-hidden="true">▣ {dir === "up" ? "↑" : dir === "down" ? "↓" : ""}</span>}
              {stops.includes(f) && f !== floor && <span style={{ marginLeft: "auto", color: "var(--accent)" }}>stop</span>}
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gap: 8, minWidth: 180, flex: 1 }}>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)" }}>Tap floors to add stops, then step time. The lift keeps going while there are stops ahead, then turns.</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button className="btn small" onClick={step}>Step one tick</button>
            <button className="btn small" onClick={() => { setFloor(4); setDir("idle"); setStops([]); setLog([]); }} aria-label="Reset the lift">↺</button>
          </div>
          <p style={{ margin: 0, fontSize: 13.5 }} data-testid="scan-log">Stopped at: {log.length ? log.join(", ") : "nowhere yet"}</p>
        </div>
      </div>
    </div>
  );
}

type BookOrder = { id: string; side: "buy" | "sell"; price: number; qty: number };

const openingBook: BookOrder[] = [
  { id: "S1", side: "sell", price: 103, qty: 6 },
  { id: "S2", side: "sell", price: 101, qty: 5 },
  { id: "S3", side: "sell", price: 102, qty: 4 },
  { id: "S4", side: "sell", price: 101, qty: 3 },
  { id: "B1", side: "buy", price: 99, qty: 6 },
  { id: "B2", side: "buy", price: 100, qty: 4 },
  { id: "B3", side: "buy", price: 99, qty: 2 },
  { id: "B4", side: "buy", price: 98, qty: 8 },
];

/** A small order book: send orders and watch them match by price, then time. */
export function BookLadder() {
  const [book, setBook] = useState<BookOrder[]>(openingBook);
  const [next, setNext] = useState(1);
  const [line, setLine] = useState("The book before the open. Send an order.");
  const send = (side: "buy" | "sell", qty: number, limit: number | null) => {
    const id = `${side === "buy" ? "N" : "M"}${next}`;
    const rest = book.map((o) => ({ ...o }));
    const fills: string[] = [];
    let left = qty;
    while (left > 0) {
      // the array keeps arrival order, so the first order at the best price is first in line
      const other = rest.filter((o) => o.side !== side && o.qty > 0);
      if (!other.length) break;
      const best = side === "buy" ? Math.min(...other.map((o) => o.price)) : Math.max(...other.map((o) => o.price));
      if (limit !== null && (side === "buy" ? best > limit : best < limit)) break;
      const front = other.find((o) => o.price === best)!;
      const q = Math.min(left, front.qty);
      fills.push(`${q} at ${best} from ${front.id}`);
      front.qty -= q;
      left -= q;
    }
    const after = rest.filter((o) => o.qty > 0);
    if (left > 0 && limit !== null) after.push({ id, side, price: limit, qty: left });
    setBook(after);
    setNext(next + 1);
    const what = `${id}: ${side} ${qty}${limit === null ? " at market" : ` at ${limit}`}`;
    const tail = left === 0 ? "Filled." : limit === null ? `${left} left over, cancelled.` : `${left} rest${left === qty ? "s" : ""} at ${limit}.`;
    setLine(`${what}. ${fills.length ? `Traded ${fills.join(", ")}.` : "No trade."} ${tail}`);
  };
  const prices = [...new Set(book.map((o) => o.price))].sort((a, b) => b - a);
  return (
    <div className="figure" data-interactive>
      <p className="fig-label">Try it · price, then time</p>
      <div style={{ display: "grid", gap: 3, marginBottom: 10 }} aria-label="The book, highest price first">
        {prices.map((p, i) => {
          const here = book.filter((o) => o.price === p);
          const side = here[0].side;
          const firstBid = side === "buy" && (i === 0 || book.find((o) => o.price === prices[i - 1])!.side === "sell");
          return (
            <Fragment key={p}>
              {firstBid && i > 0 && <p style={{ margin: "2px 0", fontSize: 12, color: "var(--ink-3)", textAlign: "center" }} data-testid="book-spread">spread {prices[i - 1] - p}</p>}
              <div data-price={p} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 34, padding: "4px 8px", borderRadius: 7, background: side === "sell" ? "var(--warn-soft)" : "var(--accent-soft)" }}>
                <span style={{ width: 70, fontSize: 12, color: "var(--ink-2)" }}>{side === "sell" ? "sell" : "buy"} {p}</span>
                <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {here.map((o) => (
                    <span key={o.id} style={{ font: "500 12px var(--mono)", padding: "2px 7px", borderRadius: 5, border: `1px solid ${side === "sell" ? "var(--warn)" : "var(--accent)"}`, background: "var(--page)" }}>
                      {o.id} · {o.qty}
                    </span>
                  ))}
                </span>
              </div>
            </Fragment>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        <button className="btn small" onClick={() => send("buy", 7, 101)}>Buy 7 at 101</button>
        <button className="btn small" onClick={() => send("sell", 9, 99)}>Sell 9 at 99</button>
        <button className="btn small" onClick={() => send("buy", 10, null)}>Market buy 10</button>
        <button className="btn small" onClick={() => send("sell", 3, 100)}>Sell 3 at 100</button>
        <button className="btn small" onClick={() => { setBook(openingBook); setNext(1); setLine("Back to the opening book."); }} aria-label="Reset the book">↺</button>
      </div>
      <p role="status" style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)" }} data-testid="book-line">{line}</p>
    </div>
  );
}
