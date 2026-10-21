import type { NextRequest } from "next/server";
import { parseContext } from "@/lib/context-parse";
import { shopsForProduct } from "@/lib/server/catalog";
import { json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { origin, filters } = parseContext(req.nextUrl.searchParams);
  const data = await shopsForProduct({ productId: id, origin, filters });
  if (!data) return json({ error: "not found" }, { status: 404 });
  return json(data);
}
