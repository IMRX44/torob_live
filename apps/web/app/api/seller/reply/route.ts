import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSellerShopId } from "@/lib/server/session";
import { replyToTarget } from "@/lib/server/inquiries";
import { badRequest, json } from "@/lib/server/http";

const Body = z.object({
  targetId: z.string(),
  status: z.enum(["available", "price_changed", "unavailable", "alternative"]),
  price: z.number().int().positive().max(50_000_000_000).nullable().optional(),
  note: z.string().max(300).nullable().optional(),
  altProductId: z.string().nullable().optional(),
  holdMinutes: z.number().int().min(10).max(24 * 60).nullable().optional(),
  openUntil: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const shopId = await getSellerShopId();
  if (!shopId) return json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest(parsed.error);
  const { targetId, ...input } = parsed.data;
  try {
    await replyToTarget(targetId, shopId, input);
    return json({ ok: true });
  } catch {
    return json({ error: "این استعلام پیدا نشد" }, { status: 404 });
  }
}
