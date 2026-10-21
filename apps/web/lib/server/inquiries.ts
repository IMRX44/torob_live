import "server-only";
import { formatToman } from "@torob/core";
import { sql } from "./db";
import { publish } from "./events";
import { newId } from "./session";
import type { Inquiry, SellerInboxItem, TargetStatus } from "../inquiry-types";

export type { Inquiry, SellerInboxItem, TargetStatus };

type Row = {
  inquiry_id: string;
  product_id: string | null;
  product_title: string | null;
  product_image: string | null;
  message: string;
  created_at: Date;
  timeout_sec: number;
  target_id: string;
  shop_id: string;
  shop_name: string;
  mall_name: string | null;
  floor: number | null;
  unit: string | null;
  lat: number;
  lon: number;
  listed_price: string | null;
  status: TargetStatus;
  reply_price: string | null;
  reply_note: string | null;
  alt_product_id: string | null;
  alt_title: string | null;
  hold_until: Date | null;
  open_until: string | null;
  seen_at: Date | null;
  replied_at: Date | null;
};

function group(rows: Row[]): Inquiry[] {
  const map = new Map<string, Inquiry>();
  const now = Date.now();
  for (const r of rows) {
    const deadline = new Date(new Date(r.created_at).getTime() + r.timeout_sec * 1000);
    let inq = map.get(r.inquiry_id);
    if (!inq) {
      inq = {
        id: r.inquiry_id,
        productId: r.product_id,
        productTitle: r.product_title,
        productImage: r.product_image,
        message: r.message,
        createdAt: new Date(r.created_at).toISOString(),
        deadline: deadline.toISOString(),
        targets: [],
      };
      map.set(r.inquiry_id, inq);
    }
    const timedOut = (r.status === "pending" || r.status === "seen") && deadline.getTime() < now;
    inq.targets.push({
      id: r.target_id,
      shopId: r.shop_id,
      shopName: r.shop_name,
      mallName: r.mall_name,
      floor: r.floor,
      unit: r.unit,
      lat: r.lat,
      lon: r.lon,
      listedPrice: r.listed_price == null ? null : Number(r.listed_price),
      status: timedOut ? "timeout" : r.status,
      replyPrice: r.reply_price == null ? null : Number(r.reply_price),
      replyNote: r.reply_note,
      altProductId: r.alt_product_id,
      altProductTitle: r.alt_title,
      holdUntil: r.hold_until ? new Date(r.hold_until).toISOString() : null,
      openUntil: r.open_until,
      seenAt: r.seen_at ? new Date(r.seen_at).toISOString() : null,
      repliedAt: r.replied_at ? new Date(r.replied_at).toISOString() : null,
    });
  }
  return [...map.values()];
}

const SELECT = () => sql()`
  SELECT i.id AS inquiry_id, i.product_id, p.title AS product_title, p.images[1] AS product_image, i.message,
         i.created_at, i.timeout_sec, t.id AS target_id, t.shop_id, s.name AS shop_name, s.mall_name, s.floor, s.unit,
         s.lat, s.lon, t.listed_price, t.status, t.reply_price, t.reply_note, t.alt_product_id, ap.title AS alt_title,
         t.hold_until, t.open_until, t.seen_at, t.replied_at
  FROM inquiries i
  JOIN inquiry_targets t ON t.inquiry_id = i.id
  JOIN shops s ON s.id = t.shop_id
  LEFT JOIN products p ON p.id = i.product_id
  LEFT JOIN products ap ON ap.id = t.alt_product_id`;

export function defaultMessage(productTitle: string, listedPrice: number | null) {
  const price = listedPrice ? ` با قیمت ثبت‌شده ${formatToman(listedPrice)}` : "";
  return `سلام، وقت بخیر. «${productTitle}»${price} الان موجوده؟ قیمت به‌روزش چنده و امروز تا چه ساعتی تشریف دارید؟ می‌خوام حضوری بیام. ممنون 🙏`;
}

export async function createInquiry(input: {
  sessionId: string;
  productId: string;
  shopIds: string[];
  message?: string;
  timeoutSec?: number;
}): Promise<Inquiry> {
  const db = sql();
  const [product] = await db<{ title: string }[]>`SELECT title FROM products WHERE id = ${input.productId}`;
  if (!product) throw new Error("product not found");
  const offers = await db<{ shop_id: string; id: string; price: string | null }[]>`
    SELECT shop_id, id, price FROM offers WHERE product_id = ${input.productId} AND shop_id = ANY(${input.shopIds})`;
  const byShop = new Map(offers.map((o) => [o.shop_id, o]));
  const id = newId("inq");
  const listed = offers.find((o) => o.price)?.price;
  const message = input.message?.trim() || defaultMessage(product.title, listed ? Number(listed) : null);
  await db.begin(async (tx) => {
    await tx`INSERT INTO inquiries (id, session_id, product_id, message, timeout_sec)
             VALUES (${id}, ${input.sessionId}, ${input.productId}, ${message}, ${input.timeoutSec ?? 90})`;
    for (const shopId of [...new Set(input.shopIds)].slice(0, 6)) {
      const o = byShop.get(shopId);
      await tx`INSERT INTO inquiry_targets (id, inquiry_id, shop_id, offer_id, listed_price)
               VALUES (${newId("tgt")}, ${id}, ${shopId}, ${o?.id ?? null}, ${o?.price ?? null})`;
    }
  });
  for (const shopId of input.shopIds) await publish(`shop:${shopId}`, { type: "inquiry", inquiryId: id });
  const inq = (await getInquiry(id))!;
  return inq;
}

export async function getInquiry(id: string): Promise<Inquiry | null> {
  const rows = await sql()<Row[]>`${SELECT()} WHERE i.id = ${id} ORDER BY t.created_at`;
  return group(rows)[0] ?? null;
}

export async function listInquiries(sessionId: string, limit = 20): Promise<Inquiry[]> {
  const rows = await sql()<Row[]>`
    ${SELECT()} WHERE i.id IN (SELECT id FROM inquiries WHERE session_id = ${sessionId} ORDER BY created_at DESC LIMIT ${limit})
    ORDER BY i.created_at DESC, t.created_at`;
  return group(rows);
}

export async function sessionOwns(sessionId: string, inquiryId: string) {
  const [r] = await sql()`SELECT 1 FROM inquiries WHERE id = ${inquiryId} AND session_id = ${sessionId}`;
  return Boolean(r);
}

export async function sellerInbox(shopId: string): Promise<SellerInboxItem[]> {
  const rows = await sql()<Row[]>`${SELECT()} WHERE t.shop_id = ${shopId} ORDER BY i.created_at DESC LIMIT 50`;
  return group(rows).map((i) => {
    const t = i.targets[0]!;
    return {
      targetId: t.id,
      inquiryId: i.id,
      productId: i.productId,
      productTitle: i.productTitle,
      productImage: i.productImage,
      message: i.message,
      listedPrice: t.listedPrice,
      status: t.status,
      createdAt: i.createdAt,
      deadline: i.deadline,
    };
  });
}

export async function markSeen(targetId: string, shopId: string) {
  const rows = await sql()<{ inquiry_id: string; session_id: string }[]>`
    UPDATE inquiry_targets t SET status = 'seen', seen_at = now()
    FROM inquiries i
    WHERE t.id = ${targetId} AND t.shop_id = ${shopId} AND t.status = 'pending' AND i.id = t.inquiry_id
    RETURNING t.inquiry_id, i.session_id`;
  const r = rows[0];
  if (r) await publish(`session:${r.session_id}`, { type: "inquiry_update", inquiryId: r.inquiry_id });
}

export interface ReplyInput {
  status: "available" | "price_changed" | "unavailable" | "alternative";
  price?: number | null;
  note?: string | null;
  altProductId?: string | null;
  holdMinutes?: number | null;
  openUntil?: string | null;
}

/** Seller answers an inquiry; the answer also becomes a public price/stock confirmation. */
export async function replyToTarget(targetId: string, shopId: string, input: ReplyInput) {
  const db = sql();
  const hold = input.holdMinutes ? new Date(Date.now() + input.holdMinutes * 60_000) : null;
  const rows = await db<{ inquiry_id: string; session_id: string; product_id: string | null; listed_price: string | null }[]>`
    UPDATE inquiry_targets t SET
      status = ${input.status}, reply_price = ${input.price ?? null}, reply_note = ${input.note ?? null},
      alt_product_id = ${input.altProductId ?? null}, hold_until = ${hold}, open_until = ${input.openUntil ?? null},
      replied_at = now(), seen_at = coalesce(seen_at, now())
    FROM inquiries i
    WHERE t.id = ${targetId} AND t.shop_id = ${shopId} AND i.id = t.inquiry_id
    RETURNING t.inquiry_id, i.session_id, i.product_id, t.listed_price`;
  const r = rows[0];
  if (!r) throw new Error("not found");
  if (r.product_id && input.status !== "alternative") {
    const available = input.status !== "unavailable";
    const price = available ? (input.price ?? (r.listed_price ? Number(r.listed_price) : null)) : null;
    await db`INSERT INTO confirmations (shop_id, product_id, source, available, price)
             VALUES (${shopId}, ${r.product_id}, 'seller', ${available}, ${price})`;
  }
  if (input.openUntil) await setTodayClose(shopId, input.openUntil, null);
  await publish(`session:${r.session_id}`, { type: "inquiry_update", inquiryId: r.inquiry_id, targetId, status: input.status });
  return r.inquiry_id;
}

export async function setTodayClose(shopId: string, close: string | null, note: string | null) {
  await sql()`
    INSERT INTO shop_overrides (shop_id, today_close, today_date, note, updated_at)
    VALUES (${shopId}, ${close}, (now() AT TIME ZONE 'Asia/Tehran')::date, ${note}, now())
    ON CONFLICT (shop_id) DO UPDATE SET today_close = excluded.today_close, today_date = excluded.today_date,
      note = excluded.note, updated_at = now()`;
}

/** Seller confirms/updates price or stock for one of their listings directly. */
export async function sellerConfirm(shopId: string, productId: string, available: boolean, price: number | null) {
  await sql()`INSERT INTO confirmations (shop_id, product_id, source, available, price)
              VALUES (${shopId}, ${productId}, 'seller', ${available}, ${price})`;
}

export async function crowdReport(input: { sessionId: string; shopId: string; productId?: string | null; kind: "closed" | "unavailable" | "available" | "price"; price?: number | null }) {
  const db = sql();
  await db`INSERT INTO crowd_reports (session_id, shop_id, product_id, kind, price)
           VALUES (${input.sessionId}, ${input.shopId}, ${input.productId ?? null}, ${input.kind}, ${input.price ?? null})`;
  if (input.productId && input.kind !== "closed") {
    await db`INSERT INTO confirmations (shop_id, product_id, source, available, price)
             VALUES (${input.shopId}, ${input.productId}, 'crowd', ${input.kind !== "unavailable"}, ${input.price ?? null})`;
  }
}
