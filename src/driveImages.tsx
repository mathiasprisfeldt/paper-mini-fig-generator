import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
  load: (fileId: string) => Promise<string>;
}

const DriveImageContext = createContext<DriveImageContextValue | null>(null);

interface ProviderProps {
  accessToken: string | null;
  children: ReactNode;
}

export function DriveImageProvider({ accessToken, children }: ProviderProps) {
  const cacheRef = useRef(new Map<string, Promise<string>>());
  const objectUrlsRef = useRef(new Set<string>());

  useEffect(() => {
    const cache = cacheRef.current;
    const objectUrls = objectUrlsRef.current;
    return () => {
      for (const url of objectUrls) URL.revokeObjectURL(url);
      objectUrls.clear();
      cache.clear();
    };
  }, [accessToken]);

  const load = useCallback((fileId: string): Promise<string> => {
    if (!accessToken) {
      return Promise.reject(
        new DriveAuthError("Connect Google Drive to load this image."),
      );
    }

    const cached = cacheRef.current.get(fileId);
    if (cached) return cached;

    const request = downloadDriveImageBlob(accessToken, fileId)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        objectUrlsRef.current.add(url);
        return url;
      })
      .catch((error) => {
        cacheRef.current.delete(fileId);
        throw error;
      });
    cacheRef.current.set(fileId, request);
    return request;
  }, [accessToken]);

  const value = useMemo(() => ({ load }), [load]);
  return (
    <DriveImageContext.Provider value={value}>
      {children}
    </DriveImageContext.Provider>
  );
}

function useLazyEntryImageSource(
  entry: MiniFigEntry,
  targetRef: RefObject<HTMLImageElement | null>,
): string | null {
  const directSource = entry.imageDataUrl || entry.imageUrl;
  const context = useContext(DriveImageContext);
  const [visible, setVisible] = useState(false);
  const [resolved, setResolved] = useState<{
    fileId: string;
    loader: DriveImageContextValue["load"];
    url: string;
  } | null>(null);

  useEffect(() => {
    if (directSource || !entry.imageDriveFileId) return;
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
  }, [directSource, entry.imageDriveFileId, targetRef]);

  useEffect(() => {
    if (
      directSource ||
      !visible ||
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
      .catch(() => {
        // Leave the placeholder visible; reconnecting creates a new loader.
      });
    return () => {
      active = false;
    };
  }, [context, directSource, entry.imageDriveFileId, visible]);

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
}

export function DriveCreatureImage({
  entry,
  ...imageProps
}: DriveCreatureImageProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const source = useLazyEntryImageSource(entry, imageRef);
  return (
    <img
      {...imageProps}
      ref={imageRef}
      src={source ?? undefined}
      loading="lazy"
    />
  );
}
