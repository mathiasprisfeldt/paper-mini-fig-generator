import { decode, encode } from "blurhash";

const HASH_WIDTH = 32;
const HASH_HEIGHT = 32;
const X_COMPONENTS = 4;
const Y_COMPONENTS = 3;
const placeholderCache = new Map<string, string>();

export function createBlurHash(image: HTMLImageElement): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = HASH_WIDTH;
    canvas.height = HASH_HEIGHT;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    context.drawImage(image, 0, 0, HASH_WIDTH, HASH_HEIGHT);
    const pixels = context.getImageData(0, 0, HASH_WIDTH, HASH_HEIGHT);
    return encode(
      pixels.data,
      HASH_WIDTH,
      HASH_HEIGHT,
      X_COMPONENTS,
      Y_COMPONENTS,
    );
  } catch {
    // Cross-origin images without CORS headers cannot be sampled by canvas.
    return null;
  }
}

export async function createBlurHashFromUrl(url: string): Promise<string | null> {
  if (!/^https?:/i.test(url)) return null;

  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return null;
    const objectUrl = URL.createObjectURL(await response.blob());
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const candidate = new Image();
        candidate.onload = () => resolve(candidate);
        candidate.onerror = () => reject(new Error("BlurHash image failed to load."));
        candidate.src = objectUrl;
      });
      return createBlurHash(image);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

export function blurHashToDataUrl(hash: string): string | null {
  const cached = placeholderCache.get(hash);
  if (cached) return cached;

  try {
    const pixels = decode(hash, HASH_WIDTH, HASH_HEIGHT);
    const canvas = document.createElement("canvas");
    canvas.width = HASH_WIDTH;
    canvas.height = HASH_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.putImageData(
      new ImageData(new Uint8ClampedArray(pixels), HASH_WIDTH, HASH_HEIGHT),
      0,
      0,
    );
    const dataUrl = canvas.toDataURL("image/png");
    placeholderCache.set(hash, dataUrl);
    return dataUrl;
  } catch {
    return null;
  }
}
