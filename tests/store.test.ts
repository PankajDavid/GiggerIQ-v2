import { describe, expect, it } from "vitest";
import { MemoryStore } from "@/lib/store";
import { selectSchemes } from "@/lib/schemes";

describe("MemoryStore", () => {
  it("counts and expires keys", async () => {
    let now = 0;
    const store = new MemoryStore(() => now);
    expect(await store.incr("k", 60)).toBe(1);
    expect(await store.incr("k", 60)).toBe(2);
    now = 61_000;
    expect(await store.incr("k", 60)).toBe(1);
  });

  it("stores values with a TTL", async () => {
    let now = 0;
    const store = new MemoryStore(() => now);
    await store.set("a", "x", 10);
    expect(await store.get("a")).toBe("x");
    now = 11_000;
    expect(await store.get("a")).toBeNull();
  });
});

describe("multilingual scheme retrieval", () => {
  it("matches Hindi and Punjabi questions", () => {
    expect(selectSchemes("मुझे बुढ़ापे के लिए पेंशन चाहिए").map((s) => s.id)).toContain("pmsym");
    expect(selectSchemes("ਹਸਪਤਾਲ ਦਾ ਇਲਾਜ ਮਹਿੰਗਾ ਹੈ").map((s) => s.id)).toContain("pmjay");
  });

  it("matches English keywords as whole words only", () => {
    // "accident" must match PMSBY, and must not trigger any scheme via a short substring.
    expect(selectSchemes("I had an accident").map((s) => s.id)).toContain("pmsby");
    expect(selectSchemes("I want pensions")[0]?.id).toBeDefined();
    expect(selectSchemes("provide me something")).toEqual([]);
  });
});
