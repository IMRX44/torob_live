import type { NextRequest } from "next/server";
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, hasToolCall, stepCountIs, streamText } from "ai";
import { llm, llmEnabled } from "@/lib/agent/llm";
import { buildTools } from "@/lib/agent/tools";
import { candidatesBlock, systemPrompt, whereBlock } from "@/lib/agent/prompt";
import { parseIntent } from "@/lib/agent/intent";
import { fallbackPicks, likelyProduct, looksLikeFollowup, quickResults, visitLabel, whereFor } from "@/lib/agent/quick";
import type { AgentMessage, ChatContext, WherePayload } from "@/lib/agent/messages";
import { DEFAULT_ORIGIN } from "@/lib/places";
import { DEFAULT_FILTERS, type Filters, type Origin } from "@/lib/types";
import { getSessionId } from "@/lib/server/session";
import { json, rateLimit } from "@/lib/server/http";
import { fenceData, INJECTION_REPLY, screenUserText } from "@/lib/agent/guard";
import { rebuildHistory, recordToolResults } from "@/lib/agent/history";
import { redactTransform } from "@/lib/agent/redact";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

/** Tools whose card is a complete answer: stop there instead of paying for another model round-trip. */
const FINAL_TOOLS = ["planBuild", "present", "proposeInquiry", "planTrip", "suggestList", "compareProducts", "findShops", "myInquiries"];

const SMALL_TALK = /^(?:سلام|درود|هی|هلو|خسته نباشی|ممنون|مرسی|تو کی هستی|کی هستی|چی هستی|اسمت چیه|چه مدلی|چیکار (?:می ?تونی|می ?کنی|بلدی)|چه کار(?:ی)? (?:می ?تونی|می ?کنی)|کمک|راهنما)/;
function isSmallTalk(text: string) {
  const t = text.replace(/[؟?!.،,]/g, " ").replace(/\s+/g, " ").trim();
  if (t.length > 70) return false;
  if (!SMALL_TALK.test(t) && !/(?:تو|شما) (?:کی|چی) هستی|چه مدلی هستی|هوش مصنوعی/.test(t)) return false;
  // "سلام، یه گوشی میخوام" is a shopping request, not small talk.
  return !/(?:میخوام|می خوام|لازم|بخرم|قیمت|کجا|گوشی|هدفون|هندزفری|شارژر|لپ ?تاپ|کابل|لامپ|دوربین|ساعت)/.test(t);
}
const INTRO =
  "سلام! من **ترب حضوری** هستم، دستیار خرید حضوری از مغازه‌ها و پاساژهای تهران 👋\nبگو چی لازم داری؛ مدل مناسب را با دلیل پیشنهاد می‌کنم، نزدیک‌ترین فروشنده‌هایی که موقع رسیدنت باز هستند را پیدا می‌کنم، قبل از رفتن از فروشنده می‌پرسم موجوده یا نه، و اگر نبود همان لحظه جایگزین می‌دهم.";
const STARTERS = ["یه سیستم گیمینگ با ۱۰۰ میلیون می‌خوام", "هندزفری بلوتوثی تا ۳ میلیون", "شارژر اصلی آیفون؛ الان کجا برم؟", "برای برق‌کشی یه واحد چی لازمه؟"];

function lastUserText(messages: AgentMessage[]) {
  const m = [...messages].reverse().find((x) => x.role === "user");
  return (m?.parts ?? []).map((p) => (p.type === "text" ? p.text : "")).join(" ").trim();
}

export async function POST(req: NextRequest) {
  const sid = await getSessionId();
  if (!rateLimit(`chat:${sid}`, 20, 60_000)) return json({ error: "کمی آهسته‌تر 🙂" }, { status: 429 });
  const raw = await req.text();
  if (raw.length > 400_000) return json({ error: "درخواست بیش از حد بزرگ است" }, { status: 413 });
  let body: { messages: AgentMessage[]; context?: Partial<ChatContext> };
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "bad request" }, { status: 400 });
  }
  if (!Array.isArray(body.messages)) return json({ error: "bad request" }, { status: 400 });
  // Never trust client history: rebuild it from text + tool results this server recorded for this session.
  const messages = await rebuildHistory(body.messages, sid);
  const baseOrigin: Origin = body.context?.origin ?? DEFAULT_ORIGIN;
  const baseFilters: Filters = { ...DEFAULT_FILTERS, ...(body.context?.filters ?? {}) };
  const focusProductId = body.context?.focusProductId ?? null;
  const verdict = screenUserText(lastUserText(messages));
  const text = verdict.text;
  const hasHistory = messages.some((m) => m.role === "assistant");

  const stream = createUIMessageStream<AgentMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: "start" });
      writer.write({ type: "data-status", id: "status", data: { stage: "searching" }, transient: true });

      // 0a) Jailbreak / prompt-injection attempts never reach the model.
      if (!verdict.ok) {
        const id = "guard";
        writer.write({ type: "text-start", id });
        writer.write({ type: "text-delta", id, delta: verdict.reason === "empty" ? "چی لازم داری؟ 🙂" : INJECTION_REPLY });
        writer.write({ type: "text-end", id });
        writer.write({ type: "data-picks", id: "picks", data: { picks: [], question: null, followups: STARTERS } });
        writer.write({ type: "data-status", id: "status", data: { stage: "done" }, transient: true });
        writer.write({ type: "finish" });
        return;
      }

      // 0b) Greetings / "who are you": instant, on-brand answer with starters (no model, no junk search).
      if (isSmallTalk(text)) {
        const id = "intro";
        writer.write({ type: "text-start", id });
        writer.write({ type: "text-delta", id, delta: INTRO });
        writer.write({ type: "text-end", id });
        writer.write({ type: "data-picks", id: "picks", data: { picks: [], question: null, followups: STARTERS } });
        writer.write({ type: "data-status", id: "status", data: { stage: "done" }, transient: true });
        writer.write({ type: "finish" });
        return;
      }

      // 1) Instant layer: what we understood, matching products, and "where to go" — no LLM involved.
      const intent = parseIntent(text);
      writer.write({ type: "data-intent", data: { filters: intent.filters, place: intent.place, chips: intent.chips }, transient: true });
      let origin = intent.place ? { lat: intent.place.lat, lon: intent.place.lon, label: intent.place.name, source: "preset" as const } : baseOrigin;
      let filters: Filters = { ...baseFilters, ...intent.filters };

      // Builds are planned by the agent part by part; a flat product search would only show noise.
      const followup = looksLikeFollowup(text, hasHistory) || Boolean(focusProductId) || intent.wantsBuild;
      const quick = followup ? null : await quickResults(text, baseOrigin, baseFilters, body.context?.lastQuery);
      if (quick) {
        origin = quick.origin;
        filters = quick.filters;
        if (quick.items.length || quick.relaxed.length) writer.write({ type: "data-results", id: "results", data: quick });
      }

      let where: WherePayload | null = null;
      const whereTarget = focusProductId ?? (quick && (intent.wantsWhere || filters.openOnArrival || filters.visitAt) ? likelyProduct(quick.items)?.id : null);
      if (whereTarget) {
        where = await whereFor(whereTarget, origin, filters);
        if (where) writer.write({ type: "data-where", id: "where", data: where });
      }

      if (!llmEnabled()) {
        if (quick?.items.length) writer.write({ type: "data-picks", id: "picks", data: fallbackPicks(quick.items) });
        writer.write({ type: "data-status", id: "status", data: { stage: "done" }, transient: true });
        writer.write({ type: "finish" });
        return;
      }

      // 2) Agent layer: the model reasons over pre-computed facts and finishes in as few steps as possible.
      writer.write({ type: "data-status", id: "status", data: { stage: "thinking" }, transient: true });
      const ctx = { origin, filters, known: new Map(), sessionId: sid };
      const modelMessages = convertToModelMessages(messages);
      const facts: string[] = [];
      if (quick)
        facts.push(
          fenceData(
            "catalog_search",
            `نتایج جستجوی خودکار برای «${quick.query}» که همین الان به کاربر نشان داده شد${quick.dropped.length ? `؛ این کلمات در عنوان کالاها نبود و نادیده گرفته شد: ${quick.dropped.join("، ")} (از روی کاربرد انتخاب کن)` : ""}${quick.relaxed.length ? `؛ محدودیت‌های شل‌شده: ${quick.relaxed.join("، ")}` : ""}\n${candidatesBlock(quick.items)}`,
          ),
        );
      if (where) facts.push(fenceData("where_to_go", whereBlock(where)));
      if (focusProductId && !where) facts.push(`[کاربر درباره محصول ${focusProductId} می‌پرسد]`);
      if (intent.wantsBuild)
        facts.push(
          `[درخواست ساخت سیستم/مجموعه است${intent.buildBudget ? `؛ بودجه کل ${intent.buildBudget} تومان` : "؛ بودجه معلوم نیست"}. اگر بودجه و کاربرد معلوم است مستقیم planBuild، وگرنه با present یک سؤال درباره بودجه یا کاربرد بپرس.]`,
        );
      if (!facts.length) facts.push("[پیام پیگیری است؛ از تاریخچه گفتگو و ابزارها استفاده کن]");
      if (quick?.items.length && !where) facts.push("یادآوری: پاسخ را حتماً با صدا زدن ابزار present (یا ابزار مناسب دیگر) تمام کن، نه فقط متن.");
      facts.push("یادآوری هویت: تو «ترب حضوری» هستی؛ نام مدل یا شرکت سازنده را نگو.");
      modelMessages.push({ role: "user", content: [{ type: "text", text: facts.join("\n\n") }] });

      try {
        const result = streamText({
          model: llm(),
          system: systemPrompt({ origin, filters, now: new Date(), visitLabel: visitLabel(filters) }),
          messages: modelMessages,
          tools: buildTools(ctx),
          // A real shopping request always ends in a card; chit-chat and follow-ups may answer in text.
          toolChoice: quick?.items.length && !where ? "required" : "auto",
          stopWhen: [stepCountIs(3), ...FINAL_TOOLS.map((t) => hasToolCall(t))],
          abortSignal: AbortSignal.timeout(75_000),
          experimental_transform: redactTransform(),
          maxRetries: 1,
          onError: () => {},
        });
        writer.merge(result.toUIMessageStream({ sendStart: false, sendFinish: false, sendReasoning: false }));
        await result.consumeStream();
        const steps = await result.steps;
        await recordToolResults(
          sid,
          steps.flatMap((s) => s.toolResults.map((r) => ({ toolCallId: r.toolCallId, toolName: r.toolName, input: r.input, output: r.output }))),
        ).catch(() => {});
        const usedTools = steps.some((s) => s.toolCalls.length);
        if (!usedTools && !where && quick?.items.length) writer.write({ type: "data-picks", id: "picks", data: fallbackPicks(quick.items) });
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
