import type { NextRequest } from "next/server";
import { z } from "zod";
import { createInquiry, listInquiries } from "@/lib/server/inquiries";
import { getSessionId } from "@/lib/server/session";
import { sql } from "@/lib/server/db";
import { badRequest, json, rateLimit } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sid = await getSessionId();
  if (req.nextUrl.searchParams.get("summary")) {
    const since = new Date(Number(req.nextUrl.searchParams.get("since") ?? 0) || 0);
    const [r] = await sql()<{ n: number }[]>`
      SELECT count(*)::int AS n FROM inquiry_targets t JOIN inquiries i ON i.id = t.inquiry_id
      WHERE i.session_id = ${sid} AND t.replied_at IS NOT NULL AND t.replied_at > ${since}`;
    return json({ unseen: r?.n ?? 0 });
  }
  return json({ inquiries: await listInquiries(sid) });
}

const Body = z.object({
  productId: z.string().min(3),
  shopIds: z.array(z.string()).min(1, "حداقل یک فروشگاه انتخاب کنید").max(6),
  message: z.string().max(600).optional(),
  timeoutSec: z.number().int().min(30).max(3600).optional(),
});

export async function POST(req: NextRequest) {
  const sid = await getSessionId();
  if (!rateLimit(`inq:${sid}`, 12, 60_000)) return json({ error: "تعداد استعلام زیاد است؛ کمی صبر کنید" }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return badRequest(parsed.error);
  const inquiry = await createInquiry({ sessionId: sid, ...parsed.data });
  return json({ inquiry }, { status: 201 });
}
