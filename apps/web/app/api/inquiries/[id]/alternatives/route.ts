import type { NextRequest } from "next/server";
import { parseContext } from "@/lib/context-parse";
import { getInquiry, sessionOwns } from "@/lib/server/inquiries";
import { getSessionId } from "@/lib/server/session";
import { shopsForProduct, similarProducts, withNearby } from "@/lib/server/catalog";
import { json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/**
 * Plan B when sellers don't answer or don't have it: other open sellers of the same item
 * (preferring the same hub), then similar products sold nearby.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sid = await getSessionId();
  if (!(await sessionOwns(sid, id))) return json({ error: "not found" }, { status: 404 });
  const inq = await getInquiry(id);
  if (!inq?.productId) return json({ shops: [], products: [] });
  const { origin, filters } = parseContext(req.nextUrl.searchParams);
  const asked = new Set(inq.targets.map((t) => t.shopId));
  const data = await shopsForProduct({ productId: inq.productId, origin, filters: { ...filters, openOnArrival: true } });
  const failedHubs = new Set(
    data?.offers.filter((o) => asked.has(o.shop.id) && o.hubId).map((o) => o.hubId) ?? [],
  );
  const shops = (data?.offers ?? [])
    .filter((o) => !asked.has(o.shop.id) && o.open.state !== "closed" && !(o.confirmation && !o.confirmation.available))
    .sort((a, b) => Number(failedHubs.has(b.hubId)) - Number(failedHubs.has(a.hubId)) || b.score - a.score)
    .slice(0, 4);
  const products = await withNearby(await similarProducts(inq.productId, { limit: 4 }), origin);
  return json({ shops, products, product: data?.product ?? null });
}
