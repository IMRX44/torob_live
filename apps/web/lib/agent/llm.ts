import "server-only";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/** OpenAI-compatible provider configured from env (model is swappable without code changes). */
export function llm(modelId = process.env.LLM_MODEL ?? "") {
  const provider = createOpenAICompatible({
    name: "llm",
    baseURL: process.env.LLM_BASE_URL ?? "https://codecraftapi.com/v1",
    apiKey: process.env.LLM_API_KEY,
  });
  return provider(modelId);
}

export const llmEnabled = () => Boolean(process.env.LLM_API_KEY && process.env.LLM_MODEL);
