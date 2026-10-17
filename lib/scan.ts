import { randomUUID } from "node:crypto";
import { earningSchema, type Earning } from "./earnings";

const MAX_EXTRACTED = 31;

/**
 * Turn Gemini's JSON reply into validated earnings entries.
 * Model output is untrusted: anything that fails the same schema as manual entry is dropped.
 * The worker still reviews and confirms every entry before it is saved.
 */
export function parseExtractedEntries(raw: string): Earning[] {
  let data: unknown;
  try {
    data = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];

  return data
    .slice(0, MAX_EXTRACTED)
    .map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;
      return earningSchema.safeParse({
        id: randomUUID(),
        date: row.date,
        platform: typeof row.platform === "string" ? row.platform.slice(0, 40) : row.platform,
        amount: typeof row.amount === "string" ? Number(row.amount.replace(/[^\d.]/g, "")) : row.amount,
        hours: row.hours ?? 0,
      });
    })
    .filter((r) => r.success)
    .map((r) => r.data);
}
