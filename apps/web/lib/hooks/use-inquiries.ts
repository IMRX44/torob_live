"use client";
import { useCallback, useEffect, useState } from "react";
import type { Inquiry } from "@/lib/inquiry-types";

/** Live list of the shopper's inquiries over SSE, with polling fallback. */
export function useInquiries(enabled = true) {
  const [items, setItems] = useState<Inquiry[] | null>(null);
  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/inquiries", { cache: "no-store" });
      if (r.ok) setItems((await r.json()).inquiries);
    } catch {
      /* offline */
    }
  }, []);
  useEffect(() => {
    if (!enabled) return;
    refresh();
    const es = new EventSource("/api/events?scope=session");
    es.onmessage = () => refresh();
    const poll = setInterval(refresh, 15_000);
    return () => {
      es.close();
      clearInterval(poll);
    };
  }, [enabled, refresh]);
  return { items, refresh };
}

/** Number of inquiry answers the shopper hasn't looked at yet. */
export function useInquiryBadge() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        let since = "0";
        try {
          since = localStorage.getItem("inq_seen") ?? "0";
        } catch {}
        const r = await fetch(`/api/inquiries?summary=1&since=${since}`, { cache: "no-store" });
        if (r.ok && alive) setCount((await r.json()).unseen ?? 0);
      } catch {}
    };
    load();
    const es = new EventSource("/api/events?scope=session");
    es.onmessage = load;
    return () => {
      alive = false;
      es.close();
    };
  }, []);
  return count;
}

export function markInquiriesSeen() {
  try {
    localStorage.setItem("inq_seen", String(Date.now()));
  } catch {}
}
