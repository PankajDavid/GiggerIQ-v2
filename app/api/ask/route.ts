import { NextRequest, NextResponse } from "next/server";
import { askSchema } from "@/lib/validation";
import { checkIpLimit } from "@/lib/rateLimit";
import { handleAsk, BUSY } from "@/lib/askService";

export const runtime = "nodejs";

function reply(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Block requests a browser marks as coming from another website.
 * The API uses no cookies or logins, so there is no session to hijack (no CSRF risk);
 * this only stops other sites from spending our AI quota through visitors' browsers.
 * Requests through proxies, previews or test tools (where Origin and Host can differ) are allowed,
 * and per-IP plus daily limits still apply to every request.
 */
function crossSiteBrowserRequest(req: NextRequest): boolean {
  return req.headers.get("sec-fetch-site") === "cross-site";
}

/** The proxy appends the real client address last, so the rightmost entry can't be spoofed. */
function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return forwarded?.at(-1) || req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: NextRequest) {
  if (crossSiteBrowserRequest(req)) return reply({ error: "Request not allowed." }, 403);

  if ((await checkIpLimit(clientIp(req))) !== "ok") return reply({ error: BUSY }, 429);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reply({ error: "Invalid request." }, 400);
  }
  const parsed = askSchema.safeParse(body);
  if (!parsed.success) {
    return reply({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, 400);
  }

  const result = await handleAsk(parsed.data);
  return reply(result.body, result.status);
}
