import type { HtmlCreatureSource } from "./types";

const IMAGE_EXTENSION = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

export interface DiscoveredCreature {
  id: string;
  name: string;
  imageDataUrl: string | null;
  imageUrl: string | null;
  imageDriveFileId: string | null;
}

export class SourceCorsError extends Error {
  constructor(sourceUrl: string, options?: ErrorOptions) {
    super(`Browser access to ${new URL(sourceUrl).hostname} was blocked.`, options);
    this.name = "SourceCorsError";
  }
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function decodeName(value: string): string {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Keep the original value when the URL contains malformed escapes.
  }
  return decoded
    .replace(IMAGE_EXTENSION, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function discoverSourceCreatures(
  source: HtmlCreatureSource,
): Promise<DiscoveredCreature[]> {
  let response: Response;
  try {
    response = await fetch(source.url, { mode: "cors" });
  } catch (error) {
    throw new SourceCorsError(source.url, { cause: error });
  }
  if (response.status === 455) {
    throw new Error(
      "The source website's firewall blocked the request (HTTP 455). Allow browser GET requests to this directory in the host's WAF settings.",
    );
  }
  if (!response.ok) {
    throw new Error(`The source returned HTTP ${response.status}.`);
  }

  const document = new DOMParser().parseFromString(await response.text(), "text/html");
  let elements: Element[];
  try {
    elements = Array.from(document.querySelectorAll(source.selector));
  } catch (error) {
    throw new Error("The HTML selector is not valid CSS.", { cause: error });
  }

  const discovered = new Map<string, DiscoveredCreature>();
  for (const element of elements) {
    const reference = element.getAttribute("href") || element.getAttribute("src");
    if (!reference) continue;

    let imageUrl: URL;
    try {
      imageUrl = new URL(reference, source.url);
    } catch {
      continue;
    }
    if (!IMAGE_EXTENSION.test(imageUrl.pathname)) continue;

    const filename = imageUrl.pathname.split("/").pop() || "Creature";
    const linkText = element.textContent?.trim() || "";
    const name = decodeName(linkText || filename) || decodeName(filename) || "Creature";
    const normalizedUrl = imageUrl.toString();
    discovered.set(normalizedUrl, {
      id: `source-${source.id}-${stableHash(normalizedUrl)}`,
      name,
      imageDataUrl: null,
      imageUrl: normalizedUrl,
      imageDriveFileId: null,
    });
  }

  return [...discovered.values()].sort((a, b) => a.name.localeCompare(b.name));
}
