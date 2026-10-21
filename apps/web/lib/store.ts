"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_ORIGIN } from "./places";
import { DEFAULT_FILTERS, type Filters, type Origin } from "./types";

interface CompareItem {
  id: string;
  title: string;
  image: string | null;
}

interface AppState {
  origin: Origin;
  filters: Filters;
  compare: CompareItem[];
  basket: string[];
  onboarded: boolean;
  setOrigin: (o: Origin) => void;
  setFilters: (f: Partial<Filters>) => void;
  resetFilters: () => void;
  toggleCompare: (p: CompareItem) => void;
  clearCompare: () => void;
  setBasket: (items: string[]) => void;
  setOnboarded: () => void;
}

const safeStorage = createJSONStorage(() => {
  try {
    const k = "__t";
    localStorage.setItem(k, k);
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    };
  }
});

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      origin: DEFAULT_ORIGIN,
      filters: DEFAULT_FILTERS,
      compare: [],
      basket: [],
      onboarded: false,
      setOrigin: (origin) => set({ origin }),
      setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
      resetFilters: () => set({ filters: DEFAULT_FILTERS }),
      toggleCompare: (p) =>
        set((s) => ({
          compare: s.compare.some((c) => c.id === p.id)
            ? s.compare.filter((c) => c.id !== p.id)
            : [...s.compare, p].slice(-3),
        })),
      clearCompare: () => set({ compare: [] }),
      setBasket: (basket) => set({ basket }),
      setOnboarded: () => set({ onboarded: true }),
    }),
    { name: "torob-hozori", storage: safeStorage, version: 1 },
  ),
);

/** Query-string form of origin + filters for API calls and shareable URLs. */
export function contextParams(origin: Origin, filters: Filters): URLSearchParams {
  const p = new URLSearchParams();
  p.set("lat", origin.lat.toFixed(5));
  p.set("lon", origin.lon.toFixed(5));
  p.set("ol", origin.label);
  for (const [k, v] of Object.entries(filters)) {
    if (v === null || v === false) continue;
    p.set(k, String(v));
  }
  return p;
}
