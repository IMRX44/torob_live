"use client";
import { useMemo } from "react";
import { contextParams, useApp } from "@/lib/store";

/** Current origin + filters as a query string (stable while they don't change). */
export function useContextQuery(extra?: Record<string, string | undefined | null>) {
  const origin = useApp((s) => s.origin);
  const filters = useApp((s) => s.filters);
  const extraKey = JSON.stringify(extra ?? {});
  return useMemo(() => {
    const p = contextParams(origin, filters);
    for (const [k, v] of Object.entries(extra ?? {})) if (v != null) p.set(k, v);
    return p.toString();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, filters, extraKey]);
}
