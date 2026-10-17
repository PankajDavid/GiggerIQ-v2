import { createHash } from "node:crypto";
import { getStore } from "./store";
import type { AskInput } from "./validation";

const TTL_SECONDS = 6 * 60 * 60;

/**
 * Only general-knowledge modes are cached. Complaint, document and earnings
 * requests contain personal details, so they are never cached.
 */
const CACHEABLE = new Set<AskInput["mode"]>(["safety", "schemes"]);

export interface CachedReply {
  answer: string;
  sources: { name: string; link: string }[];
}

/** Key is a SHA-256 hash, so the worker's text is never stored in readable form. */
export function cacheKey(input: AskInput): string | null {
  if (!CACHEABLE.has(input.mode)) return null;
  const normalised = input.text.toLowerCase().replace(/\s+/g, " ").trim();
  const hash = createHash("sha256").update(`${input.mode}|${input.lang}|${normalised}`).digest("hex");
  return `cache:${hash}`;
}

export async function readCache(key: string | null): Promise<CachedReply | null> {
  if (!key) return null;
  try {
    const raw = await getStore().get(key);
    return raw ? (JSON.parse(raw) as CachedReply) : null;
  } catch {
    return null; // cache failures never block an answer
  }
}

export async function writeCache(key: string | null, reply: CachedReply): Promise<void> {
  if (!key) return;
  try {
    await getStore().set(key, JSON.stringify(reply), TTL_SECONDS);
  } catch {
    /* ignore: cache is an optimisation only */
  }
}
