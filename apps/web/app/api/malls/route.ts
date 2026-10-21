import type { NextRequest } from "next/server";
import { parseContext } from "@/lib/context-parse";
import { mallsNear } from "@/lib/server/malls";
import { sql } from "@/lib/server/db";
import { json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { origin } = parseContext(req.nextUrl.searchParams);
  const [near, all] = await Promise.all([
    mallsNear(origin, 6000, 20),
    sql()<{ id: string; name: string; lat: number; lon: number; shop_count: number }[]>`SELECT id, name, lat, lon, shop_count FROM malls WHERE shop_count >= 3`,
  ]);
  return json({ near, all });
}
