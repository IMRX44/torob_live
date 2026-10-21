import "server-only";
import { sql } from "../server/db";
import { cleanUserText, sanitizeDeep, sanitizeField } from "./guard";
import type { AgentMessage } from "./messages";

type AnyPart = AgentMessage["parts"][number] & { toolCallId?: string; state?: string; input?: unknown; output?: unknown };

/**
 * Rebuilds the conversation from a client-supplied history without trusting it:
 * user turns keep only their text, assistant turns keep their text, and tool results are
 * re-hydrated from the server's own record for this session (forged ones are dropped).
 */
export async function rebuildHistory(messages: AgentMessage[], sessionId: string, maxMessages = 12): Promise<AgentMessage[]> {
  const recent = messages.slice(-maxMessages);
  const callIds = recent.flatMap((m) =>
    m.role === "assistant" ? (m.parts as AnyPart[]).filter((p) => p.type.startsWith("tool-") && p.toolCallId).map((p) => p.toolCallId!) : [],
  );
  const stored = callIds.length
    ? await sql()<{ tool_call_id: string; tool_name: string; input: unknown; output: unknown }[]>`
        SELECT tool_call_id, tool_name, input, output FROM agent_tool_results
        WHERE session_id = ${sessionId} AND tool_call_id = ANY(${callIds})`
    : [];
  const byId = new Map(stored.map((r) => [r.tool_call_id, r]));

  const out: AgentMessage[] = [];
  for (const m of recent) {
    if (m.role === "user") {
      const text = cleanUserText(m.parts.map((p) => (p.type === "text" ? p.text : "")).join(" "));
      if (text) out.push({ id: m.id, role: "user", parts: [{ type: "text", text }] });
      continue;
    }
    if (m.role !== "assistant") continue; // a client may not add system messages
    const parts: AnyPart[] = [];
    for (const p of m.parts as AnyPart[]) {
      if (p.type === "text") {
        const text = sanitizeField((p as { text: string }).text, 1500);
        if (text) parts.push({ type: "text", text } as AnyPart);
      } else if (p.type.startsWith("tool-") && p.toolCallId) {
        const row = byId.get(p.toolCallId);
        if (!row || `tool-${row.tool_name}` !== p.type) continue;
        parts.push({ type: p.type, toolCallId: p.toolCallId, state: "output-available", input: row.input, output: sanitizeDeep(row.output) } as AnyPart);
      }
    }
    if (parts.length) out.push({ id: m.id, role: "assistant", parts: parts as AgentMessage["parts"] });
  }
  return out;
}

export async function recordToolResults(
  sessionId: string,
  results: { toolCallId: string; toolName: string; input: unknown; output: unknown }[],
) {
  for (const r of results) {
    await sql()`
      INSERT INTO agent_tool_results (tool_call_id, session_id, tool_name, input, output)
      VALUES (${r.toolCallId}, ${sessionId}, ${r.toolName}, ${sql().json((r.input ?? {}) as never)}, ${sql().json((r.output ?? null) as never)})
      ON CONFLICT (tool_call_id) DO NOTHING`;
  }
}
