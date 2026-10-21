-- Tool results produced by the agent, keyed by tool call. Conversation history sent by the
-- client is re-hydrated from here, so a forged "tool result" in a request body is ignored.
CREATE TABLE IF NOT EXISTS agent_tool_results (
  tool_call_id text PRIMARY KEY,
  session_id   text NOT NULL,
  tool_name    text NOT NULL,
  input        jsonb NOT NULL,
  output       jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_tool_results_session ON agent_tool_results (session_id, created_at DESC);
