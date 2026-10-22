"use client";

import { useEffect, useRef } from "react";
import { FONT_SIZES, LINE_HEIGHTS, MARGINS, settings, THEMES } from "@/lib/settings";

/** The "Aa" menu: theme, typeface, size, line spacing, margins, two-page spread. */
export default function SettingsSheet({ wide, onClose }: { wide: boolean; onClose: () => void }) {
  const s = settings.use();
  const ref = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<typeof s>) => settings.set((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button[aria-pressed=true]")?.focus();
    const off = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (!ref.current?.contains(t) && !t.closest("[aria-label='Text and theme settings']")) onClose();
    };
    window.addEventListener("pointerdown", off);
    return () => window.removeEventListener("pointerdown", off);
  }, [onClose]);

  const row = (label: string, control: React.ReactNode) => (
    <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
      <span className="kicker">{label}</span>
      {control}
    </div>
  );

  const steps = (count: number, value: number, onPick: (i: number) => void, labels: string[]) => (
    <div className="seg" role="group">
      {Array.from({ length: count }, (_, i) => (
        <button key={i} aria-pressed={value === i} onClick={() => onPick(i)} aria-label={labels[i]}>
          {labels[i]}
        </button>
      ))}
    </div>
  );

  return (
    <div ref={ref} className="sheet" role="dialog" aria-label="Text and theme settings" data-interactive>
      {row(
        "Theme",
        <div className="seg" role="group" style={{ flexWrap: "wrap" }}>
          {THEMES.map((t) => (
            <button key={t.id} aria-pressed={s.theme === t.id} onClick={() => set({ theme: t.id })}>{t.label}</button>
          ))}
        </div>,
      )}
      {row(
        "Typeface",
        <div className="seg" role="group">
          <button aria-pressed={s.typeface === "serif"} onClick={() => set({ typeface: "serif" })} style={{ fontFamily: "var(--serif)" }}>Literata</button>
          <button aria-pressed={s.typeface === "sans"} onClick={() => set({ typeface: "sans" })}>Sans</button>
        </div>,
      )}
      {row(
        "Size",
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="btn small" aria-label="Smaller text" disabled={s.size === 0} onClick={() => set({ size: s.size - 1 })} style={{ fontSize: 12 }}>A</button>
          <div style={{ flex: 1, display: "flex", justifyContent: "space-between" }} aria-hidden="true">
            {FONT_SIZES.map((_, i) => (
              <span key={i} style={{ width: 8, height: 8, borderRadius: 4, background: i <= s.size ? "var(--ink-2)" : "var(--rule-2)" }} />
            ))}
          </div>
          <button className="btn small" aria-label="Larger text" disabled={s.size === FONT_SIZES.length - 1} onClick={() => set({ size: s.size + 1 })} style={{ fontSize: 17 }}>A</button>
        </div>,
      )}
      {row("Line spacing", steps(LINE_HEIGHTS.length, s.spacing, (i) => set({ spacing: i }), ["Tight", "Normal", "Airy"]))}
      {row("Margins", steps(MARGINS.length, s.margins, (i) => set({ margins: i }), ["Narrow", "Normal", "Wide"]))}
      {wide &&
        row(
          "Layout",
          <div className="seg" role="group">
            <button aria-pressed={!s.spread} onClick={() => set({ spread: false })}>One page</button>
            <button aria-pressed={s.spread} onClick={() => set({ spread: true })}>Two pages</button>
          </div>,
        )}
    </div>
  );
}
