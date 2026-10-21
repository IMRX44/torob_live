import type { NextRequest } from "next/server";
import { z } from "zod";
import { buildTrip } from "@/lib/server/trip";
import { DEFAULT_ORIGIN } from "@/lib/places";
import { badRequest, json, rateLimit } from "@/lib/server/http";
import { getSessionId } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const Body = z.object({
  items: z.array(z.object({ label: z.string().min(2).max(80), productId: z.string().nullable().optional() })).min(1).max(8),
  origin: z.object({ lat: z.number(), lon: z.number(), label: z.string(), source: z.enum(["gps", "preset", "map", "default"]) }).optional(),
  startAt: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  const sid = await getSessionId();
  if (!rateLimit(`trip:${sid}`, 15, 60_000)) return json({ error: "too many" }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest(parsed.error);
  const trip = await buildTrip(parsed.data.origin ?? DEFAULT_ORIGIN, parsed.data.items, {
    start: parsed.data.startAt ? new Date(parsed.data.startAt) : undefined,
  });
  return json(trip);
}
