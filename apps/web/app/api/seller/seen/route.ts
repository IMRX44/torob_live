import type { NextRequest } from "next/server";
import { getSellerShopId } from "@/lib/server/session";
import { markSeen } from "@/lib/server/inquiries";
import { json } from "@/lib/server/http";

export async function POST(req: NextRequest) {
  const shopId = await getSellerShopId();
  if (!shopId) return json({ error: "unauthorized" }, { status: 401 });
  const { targetIds } = (await req.json().catch(() => ({}))) as { targetIds?: string[] };
  for (const id of (targetIds ?? []).slice(0, 50)) await markSeen(id, shopId);
  return json({ ok: true });
}
