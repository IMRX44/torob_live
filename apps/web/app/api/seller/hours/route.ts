import type { NextRequest } from "next/server";
import { z } from "zod";
import { getSellerShopId } from "@/lib/server/session";
import { setTodayClose } from "@/lib/server/inquiries";
import { badRequest, json } from "@/lib/server/http";

const Body = z.object({ close: z.string().regex(/^\d{2}:\d{2}$/).nullable(), note: z.string().max(140).nullable().optional() });

export async function POST(req: NextRequest) {
  const shopId = await getSellerShopId();
  if (!shopId) return json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest(parsed.error);
  await setTodayClose(shopId, parsed.data.close, parsed.data.note ?? null);
  return json({ ok: true });
}
