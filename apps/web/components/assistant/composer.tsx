"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Mic, Square } from "lucide-react";
import { useSpeech } from "@/lib/hooks/use-speech";
import { haptic } from "@/lib/haptic";
import { cn } from "@/lib/cn";

export function Composer({
  onSend,
  onStop,
  busy,
  placeholder = "چی لازم داری؟ مثلاً «هندزفری بلوتوثی برای باشگاه تا ۳ میلیون»",
  autoFocus,
  size = "md",
}: {
  onSend: (text: string) => void;
  onStop?: () => void;
  busy?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  size?: "md" | "lg";
}) {
  const [text, setText] = useState("");
  const ta = useRef<HTMLTextAreaElement>(null);
  const speech = useSpeech((t, final) => {
    setText(t);
    if (final && t.trim()) {
      haptic();
      onSend(t.trim());
      setText("");
    }
  });

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(140, el.scrollHeight)}px`;
  }, [text]);

  const submit = () => {
    const t = text.trim();
    if (!t || busy) return;
    haptic();
    onSend(t);
    setText("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className={cn(
        "flex items-end gap-2 rounded-[26px] border border-line bg-elev p-2 shadow-card transition focus-within:border-brand/60 focus-within:shadow-float",
        size === "lg" && "p-2.5",
      )}
    >
      <textarea
        ref={ta}
        value={text}
        autoFocus={autoFocus}
        rows={1}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={speech.listening ? "دارم گوش می‌دم…" : placeholder}
        aria-label="پیام به دستیار"
        className={cn("min-h-10 flex-1 resize-none bg-transparent px-2.5 py-2 text-[15px] leading-6 outline-none placeholder:text-subtle", size === "lg" && "text-base")}
      />
      {speech.supported ? (
        <button
          type="button"
          onClick={() => (haptic(), speech.toggle())}
          aria-label={speech.listening ? "توقف ضبط" : "گفتن با صدا"}
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full transition",
            speech.listening ? "bg-bad text-white animate-pulse-ring" : "text-muted hover:bg-sunken",
          )}
        >
          <Mic className="size-5" />
        </button>
      ) : null}
      {busy && onStop ? (
        <button type="button" onClick={onStop} aria-label="توقف" className="grid size-10 shrink-0 place-items-center rounded-full bg-fg text-bg">
          <Square className="size-4" fill="currentColor" />
        </button>
      ) : (
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="ارسال"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-brand-fg shadow-sm transition active:scale-90 disabled:bg-sunken disabled:text-subtle"
        >
          <ArrowUp className="size-5" strokeWidth={2.6} />
        </button>
      )}
    </form>
  );
}
