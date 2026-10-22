"use client";

import { createLocalStore } from "./local-store";

export type Theme = "paper" | "sepia" | "night" | "contrast";
export type Typeface = "serif" | "sans";

export type ReaderSettings = {
  theme: Theme;
  typeface: Typeface;
  size: number;    // index into FONT_SIZES
  spacing: number; // index into LINE_HEIGHTS
  margins: number; // index into MARGINS
  spread: boolean; // two pages side by side on wide screens
};

export const FONT_SIZES = [15, 16.5, 18, 20, 22.5];
export const LINE_HEIGHTS = [1.5, 1.7, 1.9];
export const MARGINS = [16, 36, 72];

export const settings = createLocalStore<ReaderSettings>("loop:settings", {
  theme: "paper",
  typeface: "serif",
  size: 2,
  spacing: 1,
  margins: 1,
  spread: true,
});

export const THEMES: { id: Theme; label: string }[] = [
  { id: "paper", label: "Paper" },
  { id: "sepia", label: "Sepia" },
  { id: "night", label: "Night" },
  { id: "contrast", label: "High contrast" },
];

/** Applies the theme to <html>; the inline bootstrap script does the same before first paint. */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

