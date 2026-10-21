"use client";
import { useEffect, useRef, useState } from "react";

/** Fetch JSON whenever `url` changes, aborting stale requests; keeps last data while loading. */
export function useJson<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const ctrl = useRef<AbortController | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!url) return;
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setLoading(true);
    setError(null);
    fetch(url, { signal: c.signal, cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `خطای ${r.status}`);
        return r.json() as Promise<T>;
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setError(e.message || "خطای شبکه");
        setLoading(false);
      });
    return () => c.abort();
  }, [url, tick]);

  return { data, error, loading, reload: () => setTick((t) => t + 1) };
}
