import type { NextRequest } from "next/server";
import { z } from "zod";
import { crowdReport } from "@/lib/server/inquiries";
import { getSessionId } from "@/lib/server/session";
import { badRequest, json, rateLimit } from "@/lib/server/http";

const Body = z.object({
  shopId: z.string(),
  productId: z.string().nullable().optional(),
  kind: z.enum(["closed", "unavailable", "available", "price"]),
  price: z.number().int().positive().nullable().optional(),
});

/** "I'm at the shop" reports: help the next shopper and trigger instant alternatives. */
export async function POST(req: NextRequest) {
  const sid = await getSessionId();
  if (!rateLimit(`rep:${sid}`, 20, 60_000)) return json({ error: "too many" }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest(parsed.error);
  await crowdReport({ sessionId: sid, ...parsed.data });
  return json({ ok: true });
}
