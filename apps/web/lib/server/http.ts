import "server-only";
import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export const json = (data: unknown, init?: ResponseInit) => NextResponse.json(data, init);

export function badRequest(err: ZodError | string) {
  return NextResponse.json({ error: typeof err === "string" ? err : err.issues.map((i) => i.message).join("; ") }, { status: 400 });
}

/** Tiny in-memory rate limiter per key (good enough for a single instance). */
const hits = new Map<string, { n: number; reset: number }>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.reset < now) {
    hits.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  h.n++;
  return h.n <= max;
}
