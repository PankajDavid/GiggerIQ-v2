// Browser-side helpers shared by the UI components.

export interface AskResult {
  answer?: string;
  error?: string;
  sources?: { name: string; link: string }[];
  entries?: import("./earnings").Earning[];
}

export interface UploadImage {
  mimeType: "image/jpeg";
  data: string;
}

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

export async function askGiggerIQ(payload: object): Promise<AskResult> {
  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return (await res.json()) as AskResult;
  } catch {
    return { error: "Network problem. Please try again." };
  }
}

/**
 * Shrink a phone photo before upload: max 1600px on the long side, re-encoded as JPEG.
 * A 4 MB camera photo typically becomes ~200-400 KB, which cuts upload time on slow
 * mobile data and server memory per request.
 */
export async function prepareImage(file: File): Promise<UploadImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return { mimeType: "image/jpeg", data: dataUrl.split(",")[1] ?? "" };
}
