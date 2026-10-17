import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Simulate Gemini so tests are fast, free and deterministic.
vi.mock("@/lib/gemini", () => ({ generate: vi.fn() }));

import { POST } from "@/app/api/ask/route";
import { generate } from "@/lib/gemini";
import { MemoryStore, setStore, type Store } from "@/lib/store";

const mockGenerate = vi.mocked(generate);
const HOST = "giggeriq.test";
let ipCounter = 0;

function request(body: unknown, opts: { origin?: string | null; ip?: string } = {}) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    host: HOST,
    "x-forwarded-for": opts.ip ?? `10.0.0.${++ipCounter}`,
  };
  if (opts.origin !== null) headers.origin = opts.origin ?? `https://${HOST}`;
  return new NextRequest(`https://${HOST}/api/ask`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  setStore(new MemoryStore());
  mockGenerate.mockReset();
});

describe("POST /api/ask", () => {
  it("returns an AI-drafted complaint letter", async () => {
    mockGenerate.mockResolvedValue("Dear Sir, ... This is informational help, not legal advice.");
    const res = await POST(request({ mode: "complaint", lang: "en", text: "My payout was not paid for last week" }));
    expect(res.status).toBe(200);
    expect((await res.json()).answer).toContain("Dear Sir");
    expect(mockGenerate).toHaveBeenCalledOnce();
  });

  it("rejects cross-site requests", async () => {
    const res = await POST(request({ mode: "safety", lang: "en", text: "night rides" }, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("rejects requests with no Origin header", async () => {
    const res = await POST(request({ mode: "safety", lang: "en", text: "night rides" }, { origin: null }));
    expect(res.status).toBe(403);
  });

  it("rejects malformed JSON and invalid input", async () => {
    expect((await POST(request("{not json"))).status).toBe(400);
    expect((await POST(request({ mode: "complaint", lang: "fr", text: "hello" }))).status).toBe(400);
  });

  it("rejects a fake image whose bytes do not match its type", async () => {
    const fake = Buffer.from("<script>alert(1)</script>").toString("base64");
    const res = await POST(request({ mode: "document", lang: "en", text: "", image: { mimeType: "image/jpeg", data: fake } }));
    expect(res.status).toBe(400);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("returns verified scheme answers with official links", async () => {
    mockGenerate.mockResolvedValue("PM-SYM gives Rs 3,000 pension after 60.\nSOURCES: pmsym");
    const res = await POST(request({ mode: "schemes", lang: "en", text: "I need a pension for old age" }));
    const body = await res.json();
    expect(body.answer).not.toContain("SOURCES");
    expect(body.sources[0].link).toBe("https://maandhan.in");
  });

  it("says I don't know when the model cites a scheme it was not given", async () => {
    mockGenerate.mockResolvedValue("Some invented scheme.\nSOURCES: fakescheme");
    const res = await POST(request({ mode: "schemes", lang: "hi", text: "पेंशन के बारे में बताओ" }));
    const body = await res.json();
    expect(body.answer).toContain("https://eshram.gov.in");
    expect(body.sources).toEqual([]);
  });

  it("answers 'I don't know' without calling the AI when no scheme matches", async () => {
    const res = await POST(request({ mode: "schemes", lang: "en", text: "tell me about crypto investments" }));
    expect((await res.json()).answer).toContain("I don't know");
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("serves a repeated general question from cache without a second AI call", async () => {
    mockGenerate.mockResolvedValue("1. Wear a helmet.");
    const body = { mode: "safety", lang: "en", text: "Night delivery on a bike" };
    await POST(request(body));
    const second = await (await POST(request({ ...body, text: "  night DELIVERY on a bike " }))).json();
    expect(second.cached).toBe(true);
    expect(mockGenerate).toHaveBeenCalledOnce();
  });

  it("never caches personal complaint text", async () => {
    mockGenerate.mockResolvedValue("Dear Sir,");
    const body = { mode: "complaint", lang: "en", text: "My payout was not paid" };
    await POST(request(body));
    await POST(request(body));
    expect(mockGenerate).toHaveBeenCalledTimes(2);
  });

  it("rate-limits one IP after 10 requests per minute", async () => {
    mockGenerate.mockResolvedValue("ok");
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await POST(request({ mode: "complaint", lang: "en", text: `issue number ${i}` }, { ip: "1.2.3.4" }));
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it("fails closed when the rate-limit store is down", async () => {
    const broken: Store = {
      incr: () => Promise.reject(new Error("down")),
      get: () => Promise.reject(new Error("down")),
      set: () => Promise.reject(new Error("down")),
    };
    setStore(broken);
    const res = await POST(request({ mode: "complaint", lang: "en", text: "My payout was not paid" }));
    expect(res.status).toBe(429);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("returns a friendly busy message when Gemini fails", async () => {
    mockGenerate.mockRejectedValue(new Error("quota"));
    const res = await POST(request({ mode: "complaint", lang: "en", text: "My payout was not paid" }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain("busy");
  });
});
