import type { NextRequest } from "next/server";
import { normalizeFa } from "@torob/core";
import { getSellerShopId } from "@/lib/server/session";
import { sql } from "@/lib/server/db";
import { json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** The signed-in shop's own listings, with the latest seller confirmation. */
export async function GET(req: NextRequest) {
  const shopId = await getSellerShopId();
  if (!shopId) return json({ error: "unauthorized" }, { status: 401 });
  const q = normalizeFa(req.nextUrl.searchParams.get("q") ?? "");
  const rows = await sql()`
    SELECT p.id, p.title, p.images[1] AS image, o.price, o.price_changed_at,
      c.available AS confirmed_available, c.price AS confirmed_price, c.created_at AS confirmed_at
    FROM offers o JOIN products p ON p.id = o.product_id
    LEFT JOIN LATERAL (
      SELECT available, price, created_at FROM confirmations
      WHERE shop_id = o.shop_id AND product_id = o.product_id AND source = 'seller'
      ORDER BY created_at DESC LIMIT 1
    ) c ON true
    WHERE o.shop_id = ${shopId} ${q ? sql()`AND p.title_norm ILIKE ${"%" + q + "%"}` : sql()``}
    ORDER BY c.created_at DESC NULLS LAST, o.price_changed_at DESC NULLS LAST
    LIMIT 60`;
  return json({ items: rows });
}
