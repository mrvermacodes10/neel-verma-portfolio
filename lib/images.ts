"use client";
// Browser-side image optimisation before upload: fixes orientation, resizes to a sensible maximum,
// re-encodes as WebP (JPEG fallback) and builds a tiny blurred placeholder.

export interface OptimisedImage {
  blob: Blob;
  ext: "webp" | "jpg";
  width: number;
  height: number;
  blur: string; // data: URL, ~1 KB
}

const MAX_INPUT_BYTES = 30 * 1024 * 1024;

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function optimiseImage(file: File, maxDimension = 2400, quality = 0.84): Promise<OptimisedImage> {
  if (!file.type.startsWith("image/")) throw new Error(`“${file.name}” is not an image.`);
  if (file.size > MAX_INPUT_BYTES) throw new Error(`“${file.name}” is larger than 30 MB.`);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`Your browser can’t read “${file.name}”. Try a JPG, PNG or WebP file.`);
  }
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);

  let blob = await canvasToBlob(canvas, "image/webp", quality);
  let ext: OptimisedImage["ext"] = "webp";
  if (!blob || blob.type !== "image/webp") {
    blob = await canvasToBlob(canvas, "image/jpeg", quality);
    ext = "jpg";
  }
  if (!blob) throw new Error("Could not process this image.");

  const tiny = document.createElement("canvas");
  tiny.width = 20;
  tiny.height = Math.max(1, Math.round((20 * height) / width));
  tiny.getContext("2d")!.drawImage(bitmap, 0, 0, tiny.width, tiny.height);
  const blur = tiny.toDataURL("image/jpeg", 0.6);
  bitmap.close();

  return { blob, ext, width, height, blur };
}
