import type { NextRequest } from "next/server";
import { parseContext } from "@/lib/context-parse";
import { getProductsByIds, withNearby } from "@/lib/server/catalog";
import { alignSpecs } from "@/lib/agent/tools";
import { json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ids = (req.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean).slice(0, 3);
  const { origin } = parseContext(req.nextUrl.searchParams);
  const products = await withNearby(await getProductsByIds(ids), origin);
  return json({ products: products.map(({ specs: _s, images: _i, ...p }) => p), rows: alignSpecs(products) });
}
