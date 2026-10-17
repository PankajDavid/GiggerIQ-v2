import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/gemini", () => ({ generate: vi.fn() }));

import { POST } from "@/app/api/ask/route";
import { generate } from "@/lib/gemini";
import { parseExtractedEntries } from "@/lib/scan";
import { MemoryStore, setStore } from "@/lib/store";
import { whatsappLink } from "@/lib/speech";

const mockGenerate = vi.mocked(generate);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).toString("base64");

function scanRequest() {
  return new NextRequest("https://giggeriq.test/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json", host: "giggeriq.test", origin: "https://giggeriq.test", "x-forwarded-for": "9.9.9.9" },
    body: JSON.stringify({ mode: "scan", lang: "en", text: "", image: { mimeType: "image/png", data: PNG } }),
  });
}

beforeEach(() => {
  setStore(new MemoryStore());
  mockGenerate.mockReset();
});

describe("parseExtractedEntries", () => {
  it("keeps valid rows and cleans rupee strings", () => {
    const rows = parseExtractedEntries(
      JSON.stringify([
        { date: "2026-10-15", platform: "Swiggy", amount: "₹1,240", hours: 6 },
        { date: "2026-10-16", platform: "Swiggy", amount: 980 },
      ]),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ amount: 1240, platform: "Swiggy" });
    expect(rows[1].hours).toBe(0);
  });

  it("drops invalid rows and rejects non-JSON or non-array output", () => {
    expect(parseExtractedEntries('[{"date":"yesterday","platform":"Uber","amount":500}]')).toEqual([]);
    expect(parseExtractedEntries("not json")).toEqual([]);
    expect(parseExtractedEntries('{"amount":5}')).toEqual([]);
  });

  it("caps runaway output", () => {
    const many = Array.from({ length: 100 }, () => ({ date: "2026-10-01", platform: "Ola", amount: 100, hours: 1 }));
    expect(parseExtractedEntries(JSON.stringify(many))).toHaveLength(31);
  });
});

describe("POST /api/ask scan mode", () => {
  it("returns validated entries extracted by Gemini, requesting JSON output", async () => {
    mockGenerate.mockResolvedValue('[{"date":"2026-10-15","platform":"Zomato","amount":1500,"hours":7}]');
    const body = await (await POST(scanRequest())).json();
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0]).toMatchObject({ platform: "Zomato", amount: 1500 });
    expect(mockGenerate.mock.calls[0][3]).toEqual({ json: true });
  });

  it("returns no entries when the screenshot is not an earnings screen", async () => {
    mockGenerate.mockResolvedValue("[]");
    const body = await (await POST(scanRequest())).json();
    expect(body.entries).toEqual([]);
  });
});

describe("whatsappLink", () => {
  it("URL-encodes the text", () => {
    expect(whatsappLink("Hi & bye")).toBe("https://wa.me/?text=Hi%20%26%20bye");
  });
});
