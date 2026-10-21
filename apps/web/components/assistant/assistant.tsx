"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, Plus, RotateCcw } from "lucide-react";
import type { AgentMessage } from "@/lib/agent/messages";
import { useApp } from "@/lib/store";
import { Composer } from "./composer";
import { MessageView } from "./message-view";
import { Thinking } from "./thinking";
import { ContextBar } from "@/components/layout/context-bar";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { CompareTray } from "./compare-tray";
import { Hero } from "./hero";
import type { MallSummary } from "@/lib/server/malls";

const STORE_KEY = "torob-chat-v1";

function loadMessages(): AgentMessage[] {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as AgentMessage[]) : [];
  } catch {
    return [];
  }
}

export function Assistant({
  malls,
  categories,
  initialQuery,
  focusProductId,
}: {
  malls: MallSummary[];
  categories: { name: string; shop_count: number }[];
  initialQuery?: string | null;
  focusProductId?: string | null;
}) {
  const [initial] = useState<AgentMessage[]>(() => (typeof window === "undefined" ? [] : loadMessages()));
  const [stage, setStage] = useState<"searching" | "thinking" | "done" | "error" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const { origin, filters, setFilters, setOrigin } = useApp();
  const bottom = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  useEffect(() => {
    const el = bottom.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setAtBottom(Boolean(e?.isIntersecting)), { rootMargin: "0px 0px 160px 0px" });
    io.observe(el);
    return () => io.disconnect();
  });

  const transport = useMemo(() => new DefaultChatTransport<AgentMessage>({ api: "/api/chat" }), []);
  const { messages, sendMessage, status, stop, setMessages, error, regenerate } = useChat<AgentMessage>({
    id: "main",
    messages: initial,
    transport,
    onData: (part) => {
      if (part.type === "data-status") {
        setStage(part.data.stage);
        setNote(part.data.note ?? null);
      }
      if (part.type === "data-intent") {
        // Reflect what we understood in the context bar so it can be edited with one tap.
        const r = part.data;
        if (Object.keys(r.filters).length) setFilters(r.filters);
        if (r.place) setOrigin({ lat: r.place.lat, lon: r.place.lon, label: r.place.name, source: "preset" });
      }
    },
    onError: () => setStage("error"),
  });

  const busy = status === "submitted" || status === "streaming";
  const started = messages.length > 0;

  useEffect(() => {
    if (status === "ready" || status === "error") {
      try {
        sessionStorage.setItem(STORE_KEY, JSON.stringify(messages.slice(-30)));
      } catch {}
    }
  }, [messages, status]);

  useEffect(() => {
    if (busy) bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, busy]);

  const lastQuery = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const p = messages[i]!.parts.find((x) => x.type === "data-results");
      if (p && p.type === "data-results") return p.data.query;
    }
    return null;
  }, [messages]);

  const focus = useRef<string | null>(focusProductId ?? null);
  const send = (text: string) => {
    setStage("searching");
    const focusProduct = focus.current;
    focus.current = null; // only the first question is about the product the user came from
    sendMessage({ text }, { body: { context: { origin, filters, lastQuery, focusProductId: focusProduct } } });
  };

  const reset = () => {
    stop();
    setMessages([]);
    try {
      sessionStorage.removeItem(STORE_KEY);
    } catch {}
  };

  const autoSent = useRef(false);
  useEffect(() => {
    if (!initialQuery || autoSent.current) return;
    autoSent.current = true;
    window.history.replaceState(null, "", "/");
    send(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const lastAssistantIdx = messages.map((m) => m.role).lastIndexOf("assistant");

  return (
    <div className="relative min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/85 backdrop-blur-xl">
        <div className="flex h-14 items-center justify-between px-3">
          <div className="lg:invisible">
            <Logo compact={started} />
          </div>
          <div className="flex items-center gap-1">
            {started ? (
              <button onClick={reset} className="flex h-9 items-center gap-1 rounded-full px-3 text-[13px] font-medium text-muted hover:bg-sunken hover:text-fg">
                <Plus className="size-4" /> گفتگوی تازه
              </button>
            ) : null}
            <ThemeToggle />
          </div>
        </div>
        <ContextBar className="pt-0" />
      </header>

      {!started ? (
        <Hero onSend={send} malls={malls} categories={categories} />
      ) : (
        <div className="px-4 pt-4 pb-44">
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <MessageView message={m} onSend={send} isLatest={i === lastAssistantIdx} busy={busy && i === messages.length - 1} />
              </motion.div>
            ))}
          </AnimatePresence>
          {busy ? <Thinking stage={stage} /> : null}
          {stage === "error" && note ? <p className="mt-2 rounded-2xl bg-warn-soft px-3 py-2 text-[12px]">{note}</p> : null}
          {error && !busy ? (
            <div className="mt-3 flex items-center justify-between rounded-2xl bg-bad-soft px-3 py-2 text-[13px]">
              ارتباط با دستیار قطع شد.
              <button onClick={() => regenerate()} className="flex items-center gap-1 font-semibold text-bad">
                <RotateCcw className="size-4" /> دوباره
              </button>
            </div>
          ) : null}
          <div ref={bottom} />
        </div>
      )}

      {started ? (
        <div className="fixed inset-x-0 bottom-14 z-30 px-3 pb-2 lg:bottom-0 lg:pb-4 lg:ps-64">
          <div className="mx-auto max-w-2xl">
            <AnimatePresence>
              {!atBottom ? (
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  onClick={() => bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" })}
                  aria-label="رفتن به آخرین پیام"
                  className="mx-auto mb-2 flex h-9 items-center gap-1.5 rounded-full border border-line bg-elev px-3.5 text-[12px] font-semibold shadow-float"
                >
                  <ArrowDown className="size-4" /> آخرین پیام
                </motion.button>
              ) : null}
            </AnimatePresence>
            <CompareTray />
            <Composer onSend={send} onStop={stop} busy={busy} placeholder="ادامه بده… مثلاً «کدومش نزدیک‌تره؟»" />
          </div>
        </div>
      ) : (
        <div className="fixed inset-x-0 bottom-16 z-30 px-3 lg:bottom-4 lg:ps-64">
          <div className="mx-auto max-w-2xl">
            <CompareTray />
          </div>
        </div>
      )}
    </div>
  );
}
