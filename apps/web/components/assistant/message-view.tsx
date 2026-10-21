"use client";
import type { AgentMessage, PicksPayload } from "@/lib/agent/messages";
import { ResultsBlock } from "./results-block";
import { PicksCard } from "./picks-card";
import { CompareCard, InquiryProposalCard, MyInquiriesCard, ShopsCard, ToolPending, TripCard } from "./tool-cards";
import { WhereCard } from "./where-card";
import { ListCard } from "./list-card";
import { BuildCard } from "./build-card";
import { cn } from "@/lib/cn";

/** Inline **bold** only; everything else stays plain text (no HTML, no links: nothing to inject). */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>,
      )}
    </>
  );
}

/** Paragraphs and bullet lists from model text, rendered as React text nodes. */
function RichText({ text, streaming }: { text: string; streaming: boolean }) {
  const blocks: { kind: "p" | "ul"; lines: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const bullet = line.match(/^(?:[-•*]|\d+[.)])\s+(.*)$/);
    const last = blocks[blocks.length - 1];
    if (bullet) {
      if (last?.kind === "ul") last.lines.push(bullet[1]!);
      else blocks.push({ kind: "ul", lines: [bullet[1]!] });
    } else blocks.push({ kind: "p", lines: [line] });
  }
  return (
    <div className={cn("max-w-[92%] space-y-2 text-[14.5px] leading-7", streaming && "[&>*:last-child]:after:ms-0.5 [&>*:last-child]:after:inline-block [&>*:last-child]:after:h-4 [&>*:last-child]:after:w-1.5 [&>*:last-child]:after:animate-pulse [&>*:last-child]:after:bg-brand")}>
      {blocks.map((b, i) =>
        b.kind === "p" ? (
          <p key={i}>
            <Inline text={b.lines[0]!} />
          </p>
        ) : (
          <ul key={i} className="space-y-1 ps-1">
            {b.lines.map((l, k) => (
              <li key={k} className="flex gap-2">
                <span className="mt-[11px] size-1.5 shrink-0 rounded-full bg-brand" />
                <span>
                  <Inline text={l} />
                </span>
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

function AssistantMark() {
  return (
    <span aria-hidden className="mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-brand text-brand-fg shadow-sm">
      <svg viewBox="0 0 32 32" className="size-4">
        <path d="M16 6.5c-4.1 0-7.4 3.2-7.4 7.2 0 5.3 6.2 10.9 6.9 11.5.3.3.7.3 1 0 .7-.6 6.9-6.2 6.9-11.5 0-4-3.3-7.2-7.4-7.2Z" fill="currentColor" />
      </svg>
    </span>
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
    <div className="mt-4 flex gap-2.5">
      <AssistantMark />
      <div className="min-w-0 flex-1">
      {message.parts.map((part, i) => {
        if (part.type === "text") {
          if (!part.text.trim()) return null;
          return (
            <div key={i} className="mt-1 first:mt-0">
              <RichText text={part.text} streaming={busy && part.state === "streaming"} />
            </div>
          );
        }
        if (part.type === "data-results") return <ResultsBlock key={i} data={part.data} live={isLatest} />;
        if (part.type === "data-where") return <WhereCard key={i} data={part.data} />;
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
            case "planBuild":
              return <BuildCard key={i} data={out} />;
            case "suggestList":
              return <ListCard key={i} data={out} />;
            case "myInquiries":
              return <MyInquiriesCard key={i} data={out} />;
            default:
              return null;
          }
        }
        return null;
      })}
      </div>
    </div>
  );
}
