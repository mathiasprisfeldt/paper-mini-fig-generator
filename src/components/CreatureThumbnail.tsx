import { useCallback, useEffect, useRef, useState } from "react";
import { Box, ButtonBase, Tooltip } from "@mui/material";
import {
  blurHashToDataUrl,
  createBlurHash,
  createBlurHashFromUrl,
} from "../blurHash";
import { getEntryImageSource } from "../generatePdf";
import { DriveAuthError } from "../googleDrive";
import { DriveCreatureImage } from "../driveImages";
import type { MiniFigEntry } from "../types";

interface Props {
  entry: MiniFigEntry;
  className?: string;
  forcePlaceholder?: boolean;
  imageLoading?: "eager" | "lazy";
  interactive?: boolean;
  loadedImageKeys?: Set<string>;
  onPreview?: (id: string) => void;
  onBlurHash?: (id: string, blurHash: string) => void;
}

export function CreatureThumbnail({
  entry,
  className = "",
  forcePlaceholder = false,
  imageLoading = "lazy",
  interactive = true,
  loadedImageKeys,
  onPreview,
  onBlurHash,
}: Props) {
  const hasImage = Boolean(getEntryImageSource(entry) || entry.imageDriveFileId);
  const imageKey = getEntryImageSource(entry) || entry.imageDriveFileId || "";
  const [settledImageKey, setSettledImageKey] = useState(() =>
    loadedImageKeys?.has(imageKey) ? imageKey : "",
  );
  const [failedImageKey, setFailedImageKey] = useState("");
  const [disconnectedDriveImageKey, setDisconnectedDriveImageKey] = useState("");
  const attemptedImageKeys = useRef(new Set<string>());
  const currentImageKey = useRef(imageKey);

  useEffect(() => {
    currentImageKey.current = imageKey;
  }, [imageKey]);

  const isLoading =
    hasImage &&
    (forcePlaceholder || (
      settledImageKey !== imageKey &&
      failedImageKey !== imageKey &&
      !loadedImageKeys?.has(imageKey)
    ));
  const hasFailed = !forcePlaceholder && failedImageKey === imageKey;
  const hasLoaded = !isLoading && !hasFailed;
  const blurPlaceholder = entry.blurHash
    ? blurHashToDataUrl(entry.blurHash)
    : null;
  const showBlurPlaceholder = Boolean(blurPlaceholder);

  const revealImage = useCallback((loadedKey: string) => {
    loadedImageKeys?.add(loadedKey);
    setSettledImageKey(loadedKey);
  }, [loadedImageKeys]);

  const handleImageFailure = useCallback((failedKey: string) => {
    if (currentImageKey.current === failedKey) {
      setFailedImageKey(failedKey);
    }
  }, []);
  const handleSourceFailure = useCallback(
    (error: unknown) => {
      if (error instanceof DriveAuthError) {
        setDisconnectedDriveImageKey(imageKey);
      }
      handleImageFailure(imageKey);
    },
    [handleImageFailure, imageKey],
  );
  const isDriveDisconnected = disconnectedDriveImageKey === imageKey;

  const handleImageLoad = async (
    image: HTMLImageElement,
    loadedKey: string,
  ) => {
    revealImage(loadedKey);
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
            className={`creature-thumbnail-placeholder ${showBlurPlaceholder ? "has-blurhash" : "is-neutral"}${hasLoaded ? " is-loaded" : ""}${hasFailed ? " is-failed" : ""}`}
            role={isLoading ? "status" : undefined}
            style={showBlurPlaceholder
              ? { backgroundImage: `url(${blurPlaceholder})` }
              : undefined}
          >
            {isLoading && (
              <span className="sr-only">Loading {entry.name || "creature"} image</span>
            )}
          </span>
          {!forcePlaceholder && (
            <>
              <DriveCreatureImage
                entry={entry}
                className="creature-art-backdrop"
                alt=""
                aria-hidden="true"
                decoding="async"
                loading={imageLoading}
                onSourceError={handleSourceFailure}
              />
              <DriveCreatureImage
                entry={entry}
                className="creature-art-foreground"
                alt=""
                decoding="async"
                loading={imageLoading}
                onImageReady={(image, loadedKey) =>
                  void handleImageLoad(image, loadedKey)}
                onError={() => handleImageFailure(imageKey)}
                onSourceError={handleSourceFailure}
              />
            </>
          )}
          {isDriveDisconnected && !forcePlaceholder && (
            <Tooltip title="Connect with Drive">
              <span
                className="creature-thumbnail-drive-error"
                aria-label="Connect with Drive"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v6m0 4h.01" />
                </svg>
              </span>
            </Tooltip>
          )}
        </>
      ) : (
        <span className="creature-thumbnail-empty" aria-hidden="true">◇</span>
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
      aria-label={`${isDriveDisconnected ? "Google Drive is disconnected. " : ""}Preview ${entry.name || "creature"} export`}
      aria-busy={isLoading || undefined}
    >
      {content}
    </ButtonBase>
  );
}
