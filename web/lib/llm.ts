/**
 * Live model calls for the arena. Groq's OpenAI-compatible endpoint over plain fetch: no SDK in the
 * function bundle, and the provider can be swapped with LLM_BASE_URL.
 */

export type ArenaModel = { id: string; label: string; extra?: Record<string, unknown> };

// Only cheap, fast models (all on Groq's free tier when chosen). Settings checked by a live probe:
// gpt-oss needs low reasoning effort and qwen hidden reasoning, or short replies come back empty or slow.
export const ARENA_MODELS: ArenaModel[] = [
  { id: "allam-2-7b", label: "allam-2-7b" },
  { id: "openai/gpt-oss-20b", label: "gpt-oss-20b", extra: { reasoning_effort: "low" } },
  { id: "openai/gpt-oss-120b", label: "gpt-oss-120b", extra: { reasoning_effort: "low" } },
  { id: "qwen/qwen3.8-27b", label: "qwen3.8-27b", extra: { reasoning_format: "hidden" } },
];

export const MAX_PROMPT_CHARS = 500;
export const MAX_OUTPUT_TOKENS = 350;
const TIMEOUT_MS = 15_000;

const SYSTEM =
  "You are a helpful assistant. Reply in the same language and script as the user (Urdu, Roman Urdu or English). " +
  "Keep answers short (under 120 words). Do not give medical, legal or financial advice; say you can only give general information.";

export type Chat = (model: ArenaModel, prompt: string, system?: string) => Promise<string>;

export function groqChat(
  apiKey: string,
  baseUrl = "https://api.groq.com/openai/v1",
  fetchFn: typeof fetch = fetch,
): Chat {
  return async (model, prompt, system = SYSTEM) => {
    const res = await fetchFn(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model.id,
        temperature: 0.7,
        max_tokens: MAX_OUTPUT_TOKENS,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        ...model.extra,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`model ${model.id} returned ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error(`model ${model.id} returned an empty reply`);
    return text;
  };
}
