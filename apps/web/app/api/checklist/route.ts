import type { NextRequest } from "next/server";
import { generateObject } from "ai";
import { z } from "zod";
import { sql } from "@/lib/server/db";
import { llm, llmEnabled } from "@/lib/agent/llm";
import { json } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GENERIC = [
  "قبل از پرداخت، کالا را جلوی خودتان روشن و تست کنید.",
  "کارت یا برچسب گارانتی و نام شرکت گارانتی‌کننده را بررسی کنید.",
  "فاکتور با تاریخ، مهر فروشگاه و مشخصات دقیق مدل بگیرید.",
  "مدل و کد روی جعبه را با مشخصات اعلام‌شده تطبیق دهید.",
  "درباره شرایط مرجوعی و تعویض قبل از خرید بپرسید.",
];

const Schema = z.object({ items: z.array(z.string().min(4).max(140)).min(4).max(7) });

/** Category-specific in-store buying checklist, generated once and cached. */
export async function GET(req: NextRequest) {
  const category = (req.nextUrl.searchParams.get("category") ?? "").slice(0, 120);
  if (!category) return json({ items: GENERIC, source: "generic" });
  // Only real catalog categories reach the prompt and the shared cache (no stored prompt injection).
  const [known] = await sql()<{ name: string }[]>`SELECT name FROM categories WHERE name = ${category}`;
  if (!known) return json({ items: GENERIC, source: "generic" });
  const [cached] = await sql()<{ items: string[] }[]>`SELECT items FROM checklists WHERE category = ${category}`;
  if (cached) return json({ items: cached.items, source: "cache" });
  if (!llmEnabled()) return json({ items: GENERIC, source: "generic" });
  try {
    const { object } = await generateObject({
      model: llm(),
      schema: Schema,
      system:
        "تو یک کارشناس خرید حضوری در بازار تهران هستی. فقط چک‌لیست عملی، کوتاه و دقیق فارسی بده؛ هر مورد یک جمله کوتاه و قابل‌انجام در مغازه.",
      prompt: `چک‌لیست ۵ تا ۶ موردی برای کسی که می‌خواهد «${category}» را حضوری از مغازه بخرد: چه چیزهایی را قبل از پرداخت چک کند (اصالت، گارانتی، تست، رجیستری در صورت نیاز، فاکتور، نکات فنی مخصوص همین دسته).`,
      maxRetries: 1,
    });
    await sql()`INSERT INTO checklists (category, items) VALUES (${category}, ${sql().json(object.items)}) ON CONFLICT DO NOTHING`;
    return json({ items: object.items, source: "llm" });
  } catch {
    return json({ items: GENERIC, source: "generic" });
  }
}
