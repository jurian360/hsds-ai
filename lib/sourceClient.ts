"use client";

export type SourceType = "url" | "pdf" | "image" | "text";

/** A source the user has chosen but that hasn't been extracted server-side yet. */
export interface SourceDraft {
  type: SourceType;
  /** What to show in the list before the server returns a real label. */
  label: string;
  url?: string;
  text?: string;
  file?: File;
  /** Object URL for an image preview; revoked once the draft is discarded. */
  previewUrl?: string;
}

export interface SavedSource {
  type: SourceType;
  label: string;
  text: string;
  imageUrl?: string;
  addedAt?: string;
}

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  url: "Link",
  pdf: "PDF",
  image: "Image",
  text: "Text",
};

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1600;

/**
 * Shrinks oversized photos in the browser before upload. Phone photos are
 * routinely 8 MB+, which both exceeds the upload limit and costs more to read
 * than the extra detail is worth.
 */
export async function prepareImage(file: File): Promise<File> {
  if (file.size <= 1_500_000) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(
    1,
    MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height)
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85)
  );
  if (!blob || blob.size >= file.size) return file;

  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}

/** Sends one draft to the extraction endpoint and returns the updated product. */
export async function submitSource(productId: string, draft: SourceDraft) {
  let res: Response;

  if (draft.file) {
    const form = new FormData();
    form.append("productId", productId);
    form.append("type", draft.type);
    form.append("file", draft.file);
    res = await fetch("/api/sources", { method: "POST", body: form });
  } else {
    res = await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        type: draft.type,
        url: draft.url,
        text: draft.text,
      }),
    });
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Could not read that source");
  return data.product;
}

export async function deleteSource(productId: string, index: number) {
  const res = await fetch(
    `/api/sources?productId=${encodeURIComponent(productId)}&index=${index}`,
    { method: "DELETE" }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Could not remove that source");
  return data.product;
}
