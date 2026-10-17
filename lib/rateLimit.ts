import { getStore } from "./store";

const PER_IP_PER_MINUTE = 10;
const DAILY_AI_CAP = Number(process.env.DAILY_AI_CAP ?? 200);
const DAY_SECONDS = 86_400;

export type LimitResult = "ok" | "too_many" | "daily_cap" | "unavailable";

const minuteBucket = (now: number) => Math.floor(now / 60_000);
const dayBucket = (now: number) => new Date(now).toISOString().slice(0, 10);

/**
 * Per-IP limit: 10 requests per minute (fixed window).
 * Fails closed: if the store is unreachable, the request is refused.
 */
export async function checkIpLimit(ip: string, now = Date.now()): Promise<LimitResult> {
  try {
    const count = await getStore().incr(`rl:ip:${ip}:${minuteBucket(now)}`, 60);
    return count > PER_IP_PER_MINUTE ? "too_many" : "ok";
  } catch {
    return "unavailable";
  }
}

/**
 * Reserve one paid Gemini call against the daily cap. Only called on cache misses.
 * Fails closed so a store outage can never allow unlimited paid calls.
 */
export async function reserveAiCall(now = Date.now()): Promise<LimitResult> {
  try {
    const count = await getStore().incr(`rl:ai:${dayBucket(now)}`, DAY_SECONDS);
    return count > DAILY_AI_CAP ? "daily_cap" : "ok";
  } catch {
    return "unavailable";
  }
}
