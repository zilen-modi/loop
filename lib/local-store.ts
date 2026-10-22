"use client";

import { useSyncExternalStore } from "react";

// A tiny localStorage-backed store with React subscriptions. Everything Loop remembers
// (settings, progress, highlights, cards) lives on this device; there are no accounts yet.

export type LocalStore<T> = {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (cb: () => void) => () => void;
  use: () => T;
};

export function createLocalStore<T>(key: string, initial: T): LocalStore<T> {
  let value: T | undefined;
  const listeners = new Set<() => void>();

  const read = (): T => {
    if (value !== undefined) return value;
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      value = raw ? { ...initial, ...JSON.parse(raw) } : initial;
    } catch {
      value = initial;
    }
    return value as T;
  };

  const store: LocalStore<T> = {
    get: read,
    set(next) {
      value = typeof next === "function" ? (next as (p: T) => T)(read()) : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {}
      listeners.forEach((l) => l());
    },
    subscribe(cb) {
      listeners.add(cb);
      const onStorage = (e: StorageEvent) => {
        if (e.key === key) {
          value = undefined;
          cb();
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", onStorage);
      };
    },
    use() {
      return useSyncExternalStore(store.subscribe, read, () => initial);
    },
  };
  return store;
}
