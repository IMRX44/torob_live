import type { NextRequest } from "next/server";
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, hasToolCall, stepCountIs, streamText } from "ai";
import { llm, llmEnabled } from "@/lib/agent/llm";
import { buildTools } from "@/lib/agent/tools";
import { candidatesBlock, systemPrompt } from "@/lib/agent/prompt";
import { fallbackPicks, looksLikeFollowup, quickResults } from "@/lib/agent/quick";
import type { AgentMessage, ChatContext } from "@/lib/agent/messages";
import { DEFAULT_ORIGIN } from "@/lib/places";
import { DEFAULT_FILTERS } from "@/lib/types";
import { getSessionId } from "@/lib/server/session";
import { json, rateLimit } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

function lastUserText(messages: AgentMessage[]) {
  const m = [...messages].reverse().find((x) => x.role === "user");
  return (m?.parts ?? []).map((p) => (p.type === "text" ? p.text : "")).join(" ").trim();
}

export async function POST(req: NextRequest) {
  const sid = await getSessionId();
  if (!rateLimit(`chat:${sid}`, 20, 60_000)) return json({ error: "کمی آهسته‌تر 🙂" }, { status: 429 });
  const body = (await req.json()) as { messages: AgentMessage[]; context?: Partial<ChatContext> };
  const messages = (body.messages ?? []).slice(-16);
  const origin = body.context?.origin ?? DEFAULT_ORIGIN;
  const filters = { ...DEFAULT_FILTERS, ...(body.context?.filters ?? {}) };
  const text = lastUserText(messages).slice(0, 500);
  const hasHistory = messages.filter((m) => m.role === "assistant").length > 0;

  const stream = createUIMessageStream<AgentMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: "start" });
      writer.write({ type: "data-status", id: "status", data: { stage: "searching" }, transient: true });

      const followup = looksLikeFollowup(text, hasHistory);
      const quick = followup ? null : await quickResults(text, origin, filters, body.context?.lastQuery);
      if (quick) writer.write({ type: "data-results", id: "results", data: quick });

      if (!llmEnabled()) {
        if (quick?.items.length) writer.write({ type: "data-picks", id: "picks", data: fallbackPicks(quick.items) });
        writer.write({ type: "data-status", id: "status", data: { stage: "done" }, transient: true });
        writer.write({ type: "finish" });
        return;
      }

      writer.write({ type: "data-status", id: "status", data: { stage: "thinking" }, transient: true });
      const ctx = { origin: quick?.origin ?? origin, filters: quick?.filters ?? filters, known: new Map() };
      const modelMessages = convertToModelMessages(messages);
      const hint = quick
        ? `[نتایج جستجوی خودکار برای «${quick.query}» که همین الان به کاربر نشان داده شد${quick.relaxed.length ? `؛ برخی محدودیت‌ها شل شد: ${quick.relaxed.join("، ")}` : ""}]\n${candidatesBlock(quick.items)}`
        : "[پیام پیگیری است؛ از ابزارها و تاریخچه گفتگو استفاده کن]";
      modelMessages.push({ role: "user", content: [{ type: "text", text: hint }] });

      const abort = AbortSignal.timeout(70_000);
      try {
        const result = streamText({
          model: llm(),
          system: systemPrompt({ origin: ctx.origin, filters: ctx.filters, now: new Date() }),
          messages: modelMessages,
          tools: buildTools(ctx),
          // `present`, `proposeInquiry` and `planTrip` render final cards: no need for another slow round-trip.
          stopWhen: [stepCountIs(3), hasToolCall("present"), hasToolCall("proposeInquiry"), hasToolCall("planTrip")],
          abortSignal: abort,
          maxRetries: 1,
          onError: () => {},
        });
        writer.merge(result.toUIMessageStream({ sendStart: false, sendFinish: false, sendReasoning: false }));
        await result.consumeStream();
        const steps = await result.steps;
        const presented = steps.some((s) => s.toolCalls.some((c) => c.toolName === "present"));
        if (!presented && quick?.items.length && !steps.some((s) => s.toolCalls.length)) {
          writer.write({ type: "data-picks", id: "picks", data: fallbackPicks(quick.items) });
        }
      } catch {
        if (quick?.items.length) writer.write({ type: "data-picks", id: "picks", data: fallbackPicks(quick.items) });
        writer.write({ type: "data-status", id: "status", data: { stage: "error", note: "دستیار هوشمند دیر جواب داد؛ پیشنهادهای خودکار را ببینید." }, transient: true });
      }
      writer.write({ type: "data-status", id: "status", data: { stage: "done" }, transient: true });
      writer.write({ type: "finish" });
    },
    onError: () => "مشکلی پیش آمد؛ دوباره تلاش کنید.",
  });
  return createUIMessageStreamResponse({ stream });
}
