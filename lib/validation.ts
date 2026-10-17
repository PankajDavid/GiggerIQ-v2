import { z } from "zod";
import { earningsListSchema } from "./earnings";

export const MODES = ["complaint", "safety", "schemes", "document", "earnings", "scan"] as const;
export type Mode = (typeof MODES)[number];

export const LANGS = ["en", "hi", "pa"] as const;
export type Lang = (typeof LANGS)[number];

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export const askSchema = z
  .object({
    mode: z.enum(MODES),
    lang: z.enum(LANGS),
    text: z.string().trim().max(1000).default(""),
    image: z
      .object({
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        // base64 length is ~4/3 of byte size
        data: z.string().max(Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 4),
      })
      .optional(),
    entries: earningsListSchema.optional(),
  })
  .superRefine((v, ctx) => {
    if ((v.mode === "document" || v.mode === "scan") && !v.image) {
      ctx.addIssue({ code: "custom", message: "Image required" });
    }
    if (v.mode === "earnings" && (!v.entries || v.entries.length === 0)) {
      ctx.addIssue({ code: "custom", message: "Add earnings first" });
    }
    if (["complaint", "safety", "schemes"].includes(v.mode) && v.text.length < 3) {
      ctx.addIssue({ code: "custom", message: "Please describe your question" });
    }
  });

export type AskInput = z.infer<typeof askSchema>;

const SIGNATURES: Record<string, number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]], // "RIFF" + "WEBP" at offset 8 checked below
};

/** Check real file bytes, not just the declared type. */
export function hasValidImageSignature(mimeType: string, bytes: Uint8Array): boolean {
  const sigs = SIGNATURES[mimeType];
  if (!sigs) return false;
  const headOk = sigs.some((sig) => sig.every((b, i) => bytes[i] === b));
  if (!headOk) return false;
  if (mimeType === "image/webp") {
    return String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return true;
}
