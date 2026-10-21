"use client";
import type { AgentMessage, PicksPayload } from "@/lib/agent/messages";
import { ResultsBlock } from "./results-block";
import { PicksCard } from "./picks-card";
import { CompareCard, InquiryProposalCard, ShopsCard, ToolPending, TripCard } from "./tool-cards";
import { cn } from "@/lib/cn";

/** Light formatting for assistant text: **bold** and line breaks. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>,
      )}
    </>
  );
}

type ToolPart = { type: string; state: string; input?: unknown; output?: unknown; toolCallId: string; errorText?: string };

export function MessageView({ message, onSend, isLatest, busy }: { message: AgentMessage; onSend: (t: string) => void; isLatest: boolean; busy: boolean }) {
  if (message.role === "user") {
    const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ");
    return (
      <div className="mt-5 flex justify-start first:mt-0">
        <p className="max-w-[85%] rounded-[22px] rounded-ss-md bg-fg px-4 py-2.5 text-[14px] leading-6 text-bg">{text}</p>
      </div>
    );
  }

  return (
    <div className="mt-3">
      {message.parts.map((part, i) => {
        if (part.type === "text") {
          if (!part.text.trim()) return null;
          return (
            <p key={i} className={cn("mt-2 max-w-[92%] text-[14.5px] leading-7", busy && part.state === "streaming" && "after:ms-0.5 after:inline-block after:h-4 after:w-1.5 after:animate-pulse after:bg-brand")}>
              <RichText text={part.text} />
            </p>
          );
        }
        if (part.type === "data-results") return <ResultsBlock key={i} data={part.data} live={isLatest} />;
        if (part.type === "data-picks") return <PicksCard key={i} data={part.data} onSend={onSend} interactive={isLatest} />;
        if (part.type.startsWith("tool-")) {
          const t = part as unknown as ToolPart;
          const name = t.type.slice(5);
          if (t.state === "output-error") return null;
          if (t.state !== "output-available") return <ToolPending key={i} name={name} />;
          const out = t.output as never;
          switch (name) {
            case "present":
              return <PicksCard key={i} data={out as PicksPayload} onSend={onSend} interactive={isLatest} />;
            case "compareProducts":
              return <CompareCard key={i} data={out} />;
            case "findShops":
              return <ShopsCard key={i} data={out} />;
            case "proposeInquiry":
              return <InquiryProposalCard key={i} data={out} />;
            case "planTrip":
              return <TripCard key={i} data={out} />;
            default:
              return null;
          }
        }
        return null;
      })}
    </div>
  );
}
