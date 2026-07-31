import { useEffect, useRef, useState } from "react";
import { Box, ButtonBase } from "@mui/material";
import {
  blurHashToDataUrl,
  createBlurHash,
  createBlurHashFromUrl,
} from "../blurHash";
import { getEntryImageSource } from "../generatePdf";
import { DriveCreatureImage } from "../driveImages";
import type { MiniFigEntry } from "../types";

interface Props {
  entry: MiniFigEntry;
  className?: string;
  imageLoading?: "eager" | "lazy";
  interactive?: boolean;
  showHint?: boolean;
  loadedImageKeys?: Set<string>;
  onPreview?: (id: string) => void;
  onBlurHash?: (id: string, blurHash: string) => void;
}

export function CreatureThumbnail({
  entry,
  className = "",
  imageLoading = "lazy",
  interactive = true,
  showHint = true,
  loadedImageKeys,
  onPreview,
  onBlurHash,
}: Props) {
  const hasImage = Boolean(getEntryImageSource(entry) || entry.imageDriveFileId);
  const imageKey = getEntryImageSource(entry) || entry.imageDriveFileId || "";
  const [loadedImageKey, setLoadedImageKey] = useState(() =>
    loadedImageKeys?.has(imageKey) ? imageKey : "",
  );
  const attemptedImageKeys = useRef(new Set<string>());
  const settledLayers = useRef(new Map<string, Set<"backdrop" | "foreground">>());
  const currentImageKey = useRef(imageKey);
  const revealFrame = useRef<number | null>(null);

  useEffect(() => {
    currentImageKey.current = imageKey;
    return () => {
      if (revealFrame.current !== null) {
        cancelAnimationFrame(revealFrame.current);
        revealFrame.current = null;
      }
    };
  }, [imageKey]);

  const isLoading =
    hasImage &&
    loadedImageKey !== imageKey &&
    !loadedImageKeys?.has(imageKey);
  const blurPlaceholder = entry.blurHash
    ? blurHashToDataUrl(entry.blurHash)
    : null;

  const revealImage = (loadedKey: string) => {
    if (revealFrame.current !== null) cancelAnimationFrame(revealFrame.current);
    revealFrame.current = requestAnimationFrame(() => {
      revealFrame.current = requestAnimationFrame(() => {
        revealFrame.current = null;
        loadedImageKeys?.add(loadedKey);
        setLoadedImageKey(loadedKey);
      });
    });
  };

  const settleLayer = (
    loadedKey: string,
    layer: "backdrop" | "foreground",
  ) => {
    const layers = settledLayers.current.get(loadedKey) ?? new Set();
    layers.add(layer);
    settledLayers.current.set(loadedKey, layers);
    if (layers.size === 2 && currentImageKey.current === loadedKey) {
      revealImage(loadedKey);
    }
  };

  const handleImageLoad = async (image: HTMLImageElement) => {
    const loadedKey = imageKey;
    settleLayer(loadedKey, "foreground");
    if (entry.blurHash || attemptedImageKeys.current.has(loadedKey) || !onBlurHash) {
      return;
    }
    attemptedImageKeys.current.add(loadedKey);
    const blurHash = createBlurHash(image)
      ?? await createBlurHashFromUrl(image.currentSrc || image.src);
    if (blurHash && currentImageKey.current === loadedKey) {
      onBlurHash(entry.id, blurHash);
    }
  };

  const content = (
    <>
      {hasImage ? (
        <>
          <span
            className={`creature-thumbnail-placeholder ${blurPlaceholder ? "has-blurhash" : "is-neutral"}${isLoading ? "" : " is-loaded"}`}
            role={isLoading ? "status" : undefined}
            style={blurPlaceholder
              ? { backgroundImage: `url(${blurPlaceholder})` }
              : undefined}
          >
            {isLoading && (
              <span className="sr-only">Loading {entry.name || "creature"} image</span>
            )}
          </span>
          <DriveCreatureImage
            entry={entry}
            className="creature-art-backdrop"
            alt=""
            aria-hidden="true"
            decoding="async"
            loading={imageLoading}
            onLoad={() => settleLayer(imageKey, "backdrop")}
            onError={() => settleLayer(imageKey, "backdrop")}
          />
          <DriveCreatureImage
            entry={entry}
            className="creature-art-foreground"
            alt=""
            decoding="async"
            loading={imageLoading}
            onLoad={(event) => void handleImageLoad(event.currentTarget)}
            onError={() => settleLayer(imageKey, "foreground")}
          />
        </>
      ) : (
        <span className="creature-thumbnail-empty" aria-hidden="true">◇</span>
      )}
      {showHint && (
        <span className="preview-hint" aria-hidden="true">Preview print</span>
      )}
    </>
  );
  const rootClassName =
    `creature-thumbnail${interactive ? " creature-preview-trigger" : ""}${isLoading ? " is-loading" : ""} ${className}`.trim();

  if (!interactive) {
    return (
      <Box
        component="span"
        className={rootClassName}
        aria-busy={isLoading || undefined}
      >
        {content}
      </Box>
    );
  }

  return (
    <ButtonBase
      className={rootClassName}
      component="button"
      onClick={() => onPreview?.(entry.id)}
      aria-label={`Preview ${entry.name || "creature"} export`}
      aria-busy={isLoading || undefined}
    >
      {content}
    </ButtonBase>
  );
}
