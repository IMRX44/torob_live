import type { NextRequest } from "next/server";
import { normalizeFa } from "@torob/core";
import { sql } from "@/lib/server/db";
import { json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Shop picker for the demo sign-in: shops with fresh inquiries first, then by name search. */
export async function GET(req: NextRequest) {
  const q = normalizeFa(req.nextUrl.searchParams.get("q") ?? "");
  const rows = await sql()`
    SELECT s.id, s.name, s.mall_name, s.area, s.offer_count,
      (SELECT count(*) FROM inquiry_targets t WHERE t.shop_id = s.id AND t.status IN ('pending','seen')
         AND t.created_at > now() - interval '1 day')::int AS pending
    FROM shops s
    WHERE s.offer_count > 0 ${q ? sql()`AND (s.name ILIKE ${"%" + q + "%"} OR s.mall_name ILIKE ${"%" + q + "%"})` : sql()``}
    ORDER BY pending DESC, s.offer_count DESC
    LIMIT 30`;
  return json({ items: rows });
}
