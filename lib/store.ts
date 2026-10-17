import { createClient } from "redis";

/**
 * Small key-value store used for rate limits and the answer cache.
 * Uses Redis when REDIS_URL is set (shared across instances, survives restarts);
 * falls back to process memory for local development and tests.
 */
export interface Store {
  /** Increment a counter and set its expiry on first use. Returns the new value. */
  incr(key: string, ttlSeconds: number): Promise<number>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

const MAX_MEMORY_KEYS = 10_000;

export class MemoryStore implements Store {
  private data = new Map<string, { value: string; expiresAt: number }>();

  constructor(private now: () => number = Date.now) {}

  private live(key: string) {
    const item = this.data.get(key);
    if (item && item.expiresAt <= this.now()) {
      this.data.delete(key);
      return undefined;
    }
    return item;
  }

  private put(key: string, value: string, ttlSeconds: number) {
    if (this.data.size >= MAX_MEMORY_KEYS) this.data.delete(this.data.keys().next().value as string);
    this.data.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
  }

  async incr(key: string, ttlSeconds: number) {
    const item = this.live(key);
    const next = (item ? Number(item.value) : 0) + 1;
    if (item) item.value = String(next);
    else this.put(key, String(next), ttlSeconds);
    return next;
  }

  async get(key: string) {
    return this.live(key)?.value ?? null;
  }

  async set(key: string, value: string, ttlSeconds: number) {
    this.put(key, value, ttlSeconds);
  }
}

type Redis = ReturnType<typeof createClient>;

class RedisStore implements Store {
  private client: Redis;
  private ready: Promise<unknown>;

  constructor(url: string) {
    this.client = createClient({
      url,
      socket: { connectTimeout: 3000, reconnectStrategy: (retries) => Math.min(retries * 200, 2000) },
    });
    this.client.on("error", () => console.error("redis connection error"));
    this.ready = this.client.connect();
  }

  async incr(key: string, ttlSeconds: number) {
    await this.ready;
    const [count] = (await this.client.multi().incr(key).expire(key, ttlSeconds, "NX").exec()) as [number, unknown];
    return Number(count);
  }

  async get(key: string) {
    await this.ready;
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number) {
    await this.ready;
    await this.client.set(key, value, { EX: ttlSeconds });
  }
}

let store: Store | null = null;

export function getStore(): Store {
  store ??= process.env.REDIS_URL ? new RedisStore(process.env.REDIS_URL) : new MemoryStore();
  return store;
}

/** For tests: inject a store. */
export function setStore(s: Store | null) {
  store = s;
}
