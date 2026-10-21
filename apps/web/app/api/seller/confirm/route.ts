import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSellerShopId } from "@/lib/server/session";
import { sellerConfirm } from "@/lib/server/inquiries";
import { badRequest, json } from "@/lib/server/http";

const Body = z.object({ productId: z.string(), available: z.boolean(), price: z.number().int().positive().nullable().optional() });

export async function POST(req: NextRequest) {
  const shopId = await getSellerShopId();
  if (!shopId) return json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest(parsed.error);
  await sellerConfirm(shopId, parsed.data.productId, parsed.data.available, parsed.data.price ?? null);
  return json({ ok: true });
}
