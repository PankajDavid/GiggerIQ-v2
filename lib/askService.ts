import { hasValidImageSignature, MAX_IMAGE_BYTES, type AskInput, type Lang } from "./validation";
import { selectSchemes, verifyCitations } from "./schemes";
import { buildPrompt } from "./prompts";
import { generate } from "./gemini";
import { reserveAiCall } from "./rateLimit";
import { cacheKey, readCache, writeCache, type CachedReply } from "./cache";
import { parseExtractedEntries } from "./scan";
import type { Earning } from "./earnings";

export type ServiceResult =
  | { status: 200; body: CachedReply & { cached?: boolean; entries?: Earning[] } }
  | { status: 400 | 429 | 503; body: { error: string } };

export const BUSY = "GiggerIQ is busy right now. Please try again in a minute.";

const DONT_KNOW: Record<Lang, string> = {
  en: "I don't know based on the verified scheme information I have. Please check https://eshram.gov.in or visit your nearest Common Service Centre.",
  hi: "मेरे पास मौजूद सत्यापित योजना जानकारी से मैं इसका उत्तर नहीं जानता। कृपया https://eshram.gov.in देखें या नज़दीकी कॉमन सर्विस सेंटर जाएं।",
  pa: "ਮੇਰੇ ਕੋਲ ਮੌਜੂਦ ਪ੍ਰਮਾਣਿਤ ਸਕੀਮ ਜਾਣਕਾਰੀ ਤੋਂ ਮੈਂ ਇਸ ਦਾ ਜਵਾਬ ਨਹੀਂ ਜਾਣਦਾ। ਕਿਰਪਾ ਕਰਕੇ https://eshram.gov.in ਵੇਖੋ ਜਾਂ ਨੇੜਲੇ ਕਾਮਨ ਸਰਵਿਸ ਸੈਂਟਰ ਜਾਓ।",
};

function checkImage(input: AskInput): string | null {
  if (!input.image) return null;
  const bytes = Buffer.from(input.image.data, "base64");
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return "Image must be under 4 MB.";
  if (!hasValidImageSignature(input.image.mimeType, bytes)) return "Please upload a real JPG, PNG or WebP photo.";
  return null;
}

/** Core request lifecycle, independent of HTTP so it can be tested directly. */
export async function handleAsk(input: AskInput): Promise<ServiceResult> {
  const imageError = checkImage(input);
  if (imageError) return { status: 400, body: { error: imageError } };

  const schemes = input.mode === "schemes" ? selectSchemes(input.text) : [];
  const dontKnow = { status: 200 as const, body: { answer: DONT_KNOW[input.lang], sources: [] } };
  if (input.mode === "schemes" && schemes.length === 0) return dontKnow;

  const key = cacheKey(input);
  const cached = await readCache(key);
  if (cached) return { status: 200, body: { ...cached, cached: true } };

  const budget = await reserveAiCall();
  if (budget !== "ok") return { status: 429, body: { error: BUSY } };

  try {
    const { system, user } = buildPrompt(input, schemes);
    const usesImage = input.mode === "document" || input.mode === "scan";
    const raw = await generate(system, user, usesImage ? input.image : undefined, { json: input.mode === "scan" });

    if (input.mode === "scan") {
      const entries = parseExtractedEntries(raw);
      return { status: 200, body: { answer: "", sources: [], entries } };
    }

    let reply: CachedReply = { answer: raw, sources: [] };
    if (input.mode === "schemes") {
      const checked = verifyCitations(raw, schemes);
      if (!checked.ok) return dontKnow;
      reply = { answer: checked.text, sources: checked.cited.map((s) => ({ name: s.name, link: s.link })) };
    }
    await writeCache(key, reply);
    return { status: 200, body: reply };
  } catch {
    console.error(`ask failed: mode=${input.mode}`); // never log user text or images
    return { status: 503, body: { error: BUSY } };
  }
}
