import { sql } from "@/lib/server/db";
import { json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  const t0 = Date.now();
  try {
    const [r] = await sql()<{ shops: number; offers: number }[]>`
      SELECT (SELECT count(*) FROM shops)::int AS shops, (SELECT count(*) FROM offers)::int AS offers`;
    return json({ ok: true, db: { ...r, ms: Date.now() - t0 }, llm: Boolean(process.env.LLM_API_KEY), version: process.env.APP_VERSION ?? "dev" });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, { status: 503 });
  }
}
