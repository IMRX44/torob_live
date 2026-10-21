import type { TextStreamPart, ToolSet } from "ai";
import { redactOutput } from "./guard";

/**
 * Buffers streamed text up to the last sentence boundary so a name split across chunks
 * ("Clau" + "de") is still caught, then redacts and forwards it.
 */
export function redactTransform<TOOLS extends ToolSet>() {
  return () => {
    const buf = new Map<string, string>();
    return new TransformStream<TextStreamPart<TOOLS>, TextStreamPart<TOOLS>>({
      transform(part, controller) {
        if (part.type === "text-delta") {
          const acc = (buf.get(part.id) ?? "") + part.text;
          const cut = Math.max(acc.lastIndexOf("."), acc.lastIndexOf("!"), acc.lastIndexOf("؟"), acc.lastIndexOf("?"), acc.lastIndexOf("\n"));
          if (cut >= 0) {
            controller.enqueue({ ...part, text: redactOutput(acc.slice(0, cut + 1)) });
            buf.set(part.id, acc.slice(cut + 1));
          } else buf.set(part.id, acc);
          return;
        }
        if (part.type === "text-end") {
          const rest = buf.get(part.id);
          if (rest) controller.enqueue({ type: "text-delta", id: part.id, text: redactOutput(rest) } as TextStreamPart<TOOLS>);
          buf.delete(part.id);
        }
        controller.enqueue(part);
      },
    });
  };
}
