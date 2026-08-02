import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ImgHTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react";
import { downloadDriveImageBlob, DriveAuthError } from "./googleDrive";
import type { MiniFigEntry } from "./types";

interface DriveImageContextValue {
  getCached: (fileId: string) => string | null;
  load: (fileId: string) => Promise<string>;
}

const DriveImageContext = createContext<DriveImageContextValue | null>(null);

interface ProviderProps {
  accessToken: string | null;
  children: ReactNode;
}

export function DriveImageProvider({ accessToken, children }: ProviderProps) {
  const cacheState = useMemo(() => ({
    accessToken,
    requests: new Map<string, Promise<string>>(),
    resolvedUrls: new Map<string, string>(),
    objectUrls: new Set<string>(),
  }), [accessToken]);

  useEffect(() => {
    return () => {
      for (const url of cacheState.objectUrls) URL.revokeObjectURL(url);
      cacheState.objectUrls.clear();
      cacheState.resolvedUrls.clear();
      cacheState.requests.clear();
    };
  }, [cacheState]);

  const getCached = useCallback(
    (fileId: string) => cacheState.resolvedUrls.get(fileId) ?? null,
    [cacheState],
  );

  const load = useCallback((fileId: string): Promise<string> => {
    if (!cacheState.accessToken) {
      return Promise.reject(
        new DriveAuthError("Connect Google Drive to load this image."),
      );
    }

    const cached = cacheState.requests.get(fileId);
    if (cached) return cached;

    const request = downloadDriveImageBlob(cacheState.accessToken, fileId)
      .then((blob) => {
        if (cacheState.requests.get(fileId) !== request) {
          throw new Error("Drive image request was superseded.");
        }
        const url = URL.createObjectURL(blob);
        cacheState.objectUrls.add(url);
        cacheState.resolvedUrls.set(fileId, url);
        return url;
      })
      .catch((error) => {
        if (cacheState.requests.get(fileId) === request) {
          cacheState.requests.delete(fileId);
        }
        throw error;
      });
    cacheState.requests.set(fileId, request);
    return request;
  }, [cacheState]);

  const value = useMemo(() => ({ getCached, load }), [getCached, load]);
  return (
    <DriveImageContext.Provider value={value}>
      {children}
    </DriveImageContext.Provider>
  );
}

function useLazyEntryImageSource(
  entry: MiniFigEntry,
  targetRef: RefObject<HTMLImageElement | null>,
  eager: boolean,
  onSourceError?: (error: unknown) => void,
): string | null {
  const directSource = entry.imageDataUrl || entry.imageUrl;
  const context = useContext(DriveImageContext);
  const [visible, setVisible] = useState(false);
  const [resolved, setResolved] = useState<{
    fileId: string;
    loader: DriveImageContextValue["load"];
    url: string;
  } | null>(() => {
    if (!entry.imageDriveFileId || !context) return null;
    const url = context.getCached(entry.imageDriveFileId);
    return url
      ? { fileId: entry.imageDriveFileId, loader: context.load, url }
      : null;
  });

  useEffect(() => {
    if (directSource || !entry.imageDriveFileId || eager) return;
    const target = targetRef.current;
    if (!target) return;

    if (!("IntersectionObserver" in window)) {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (records) => {
        if (!records.some((record) => record.isIntersecting)) return;
        setVisible(true);
        observer.disconnect();
      },
      { rootMargin: "300px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [directSource, eager, entry.imageDriveFileId, targetRef]);

  useEffect(() => {
    if (
      directSource ||
      (!eager && !visible) ||
      !entry.imageDriveFileId ||
      !context
    ) {
      return;
    }

    let active = true;
    void context.load(entry.imageDriveFileId)
      .then((url) => {
        if (active) {
          setResolved({
            fileId: entry.imageDriveFileId!,
            loader: context.load,
            url,
          });
        }
      })
      .catch((error: unknown) => {
        if (active) onSourceError?.(error);
      });
    return () => {
      active = false;
    };
  }, [context, directSource, eager, entry.imageDriveFileId, onSourceError, visible]);

  if (directSource) return directSource;
  if (
    resolved?.fileId === entry.imageDriveFileId &&
    resolved.loader === context?.load
  ) {
    return resolved.url;
  }
  return null;
}

interface DriveCreatureImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  entry: MiniFigEntry;
  onSourceError?: (error: unknown) => void;
  onImageReady?: (image: HTMLImageElement, imageKey: string) => void;
}

export function DriveCreatureImage({
  entry,
  loading = "lazy",
  onSourceError,
  onImageReady,
  onLoad,
  onError,
  ...imageProps
}: DriveCreatureImageProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const source = useLazyEntryImageSource(
    entry,
    imageRef,
    loading === "eager",
    onSourceError,
  );
  const imageKey = entry.imageDataUrl || entry.imageUrl || entry.imageDriveFileId || "";

  useLayoutEffect(() => {
    const image = imageRef.current;
    if (!source || !image?.complete) return;

    if (image.naturalWidth > 0) {
      onImageReady?.(image, imageKey);
    }
  }, [imageKey, onImageReady, source]);

  useEffect(() => {
    if (!source) return;

    const timer = window.setTimeout(() => {
      const image = imageRef.current;
      if (image?.complete && image.naturalWidth > 0) {
        onImageReady?.(image, imageKey);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [imageKey, onImageReady, source]);

  return (
    <img
      {...imageProps}
      ref={imageRef}
      src={source ?? undefined}
      loading={loading}
      onLoad={(event) => {
        onLoad?.(event);
        onImageReady?.(event.currentTarget, imageKey);
      }}
      onError={(event) => {
        onError?.(event);
      }}
    />
  );
}
