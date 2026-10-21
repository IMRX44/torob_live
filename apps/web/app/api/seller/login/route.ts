import type { NextRequest } from "next/server";
import { z } from "zod";
import { getShop } from "@/lib/server/catalog";
import { SELLER_COOKIE, sign } from "@/lib/server/session";
import { badRequest, json } from "@/lib/server/http";

const Body = z.object({ shopId: z.string().min(5) });

/** Demo sign-in: in production this would be an OTP to the shop's registered number. */
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest(parsed.error);
  const shop = await getShop(parsed.data.shopId);
  if (!shop) return json({ error: "فروشگاه پیدا نشد" }, { status: 404 });
  const res = json({ ok: true, shop: { id: shop.id, name: shop.name } });
  res.cookies.set(SELLER_COOKIE, sign(shop.id), { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
