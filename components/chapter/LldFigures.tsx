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
