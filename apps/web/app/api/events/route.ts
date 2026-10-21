import type { NextRequest } from "next/server";
import { subscribe } from "@/lib/server/events";
import { getSellerShopId, getSessionId } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Server-Sent Events stream for live inquiry updates (shopper) or new inquiries (seller). */
export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope");
  let topic: string;
  if (scope === "seller") {
    const shopId = await getSellerShopId();
    if (!shopId) return new Response("unauthorized", { status: 401 });
    topic = `shop:${shopId}`;
  } else {
    topic = `session:${await getSessionId()}`;
  }

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* closed */
        }
      };
      controller.enqueue(encoder.encode(`retry: 3000\n: connected\n\n`));
      const unsub = await subscribe(topic, send);
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {}
      }, 20_000);
      cleanup = () => {
        clearInterval(ping);
        unsub();
      };
      req.signal.addEventListener("abort", () => {
        cleanup?.();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      cleanup?.();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
