import { GoogleGenAI } from "@google/genai";

// Try the configured model first, then stable fallbacks in case a model ID is retired.
const MODELS = [
  ...new Set([process.env.GEMINI_MODEL, "gemini-3.8-flash", "gemini-flash-latest"].filter(Boolean)),
] as string[];
const TIMEOUT_MS = 25_000;

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

export interface GeminiImage {
  mimeType: string;
  data: string;
}

/** Single shared Gemini call used by every AI feature. Server-side only. */
export interface GenerateOptions {
  /** Ask Gemini for a JSON response (used for screenshot extraction). */
  json?: boolean;
}

export async function generate(
  system: string,
  user: string,
  image?: GeminiImage,
  options: GenerateOptions = {},
): Promise<string> {
  const parts: Array<Record<string, unknown>> = [{ text: user }];
  if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });

  let lastError: unknown;
  for (const model of MODELS) {
    try {
      const call = getClient().models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction: system,
          temperature: options.json ? 0 : 0.3,
          maxOutputTokens: 2048,
          ...(options.json ? { responseMimeType: "application/json" } : {}),
        },
      });
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS),
      );
      const res = await Promise.race([call, timeout]);
      const text = res.text?.trim();
      if (!text) throw new Error("empty response");
      return text;
    } catch (err) {
      lastError = err;
      // Log only the provider error (status + short message), never user content.
      const msg = err instanceof Error ? err.message.slice(0, 200) : String(err);
      console.error(`gemini error model=${model}: ${msg}`);
    }
  }
  throw lastError;
}
