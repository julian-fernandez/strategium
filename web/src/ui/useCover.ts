import { useCallback, useEffect, useState } from "react";
import type { Army } from "../../../shared/types";
import { type CoverSettings, coverKey, DEFAULT_COVER } from "../cards/cover";

/** Each list's cover settings, by `coverKey`. */
const COVERS_KEY = "army-cards:covers";
/**
 * Uploaded images live in IndexedDB rather than localStorage, whose few
 * megabytes a photo or two would fill. Stored by the list's cover key too.
 */
const DB_NAME = "army-cards";
const STORE = "cover-images";
/** Pixels on an upload's long edge: well over 300 dpi at the size the cover prints it. */
const MAX_EDGE = 1800;

export type Cover = {
  settings: CoverSettings;
  /** The image to show: a link, or an upload read back from this browser. */
  image?: string;
  /** Why the last upload couldn't be kept, if it couldn't. */
  error?: string;
  change: (next: Partial<CoverSettings>) => void;
  upload: (file: File) => Promise<void>;
  link: (url: string) => void;
  removeImage: () => void;
};

/** The cover for this list, remembered in this browser. A new list starts with the defaults. */
export function useCover(army: Army): Cover {
  const key = coverKey(army);
  const [covers, setCovers] = useState<Record<string, CoverSettings>>(loadCovers);
  const settings = { ...DEFAULT_COVER, ...covers[key] };
  const [error, setError] = useState<{ key: string; message: string }>();

  const update = useCallback(
    (next: (current: CoverSettings) => CoverSettings) =>
      setCovers((previous) => {
        const updated = { ...previous, [key]: next({ ...DEFAULT_COVER, ...previous[key] }) };
        saveCovers(updated);
        return updated;
      }),
    [key],
  );

  // An upload is read back as a blob URL, again after each new upload.
  const uploaded = settings.image?.kind === "upload";
  const [version, setVersion] = useState(0);
  const [blobUrl, setBlobUrl] = useState<{ key: string; version: number; url: string }>();
  useEffect(() => {
    if (!uploaded) return;
    let current = true;
    let url: string | undefined;
    getImage(key)
      .then((blob) => {
        if (!current || !blob) return;
        url = URL.createObjectURL(blob);
        setBlobUrl({ key, version, url });
      })
      .catch(() => undefined);
    return () => {
      current = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [key, uploaded, version]);

  const image =
    settings.image?.kind === "link"
      ? settings.image.url
      : uploaded && blobUrl?.key === key && blobUrl.version === version
        ? blobUrl.url
        : undefined;

  return {
    settings,
    image,
    error: error?.key === key ? error.message : undefined,
    change: (next) => update((current) => ({ ...current, ...next })),
    upload: async (file) => {
      setError(undefined);
      try {
        await putImage(key, await shrink(file));
      } catch {
        setError({ key, message: "This browser wouldn't keep the image. Try a link instead." });
        return;
      }
      update((current) => ({ ...current, image: { kind: "upload" } }));
      setVersion((v) => v + 1);
    },
    link: (url) => {
      setError(undefined);
      deleteImage(key).catch(() => undefined);
      update((current) => ({ ...current, image: { kind: "link", url } }));
    },
    removeImage: () => {
      setError(undefined);
      deleteImage(key).catch(() => undefined);
      update(({ image: _, ...current }) => current);
    },
  };
}

function loadCovers(): Record<string, CoverSettings> {
  try {
    const raw = localStorage.getItem(COVERS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CoverSettings>) : {};
  } catch {
    return {};
  }
}

function saveCovers(covers: Record<string, CoverSettings>): void {
  try {
    localStorage.setItem(COVERS_KEY, JSON.stringify(covers));
  } catch {
    // Storage can be unavailable; the cover just won't be remembered.
  }
}

/**
 * An upload at print size: a photo past MAX_EDGE is scaled down, kept as a
 * JPEG; anything else becomes a PNG, so a transparent emblem stays
 * transparent. An image the browser can't draw (an SVG) is kept as it is.
 */
async function shrink(file: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const type = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
    return blob ?? file;
  } catch {
    return file;
  }
}

function withStore<T>(
  mode: IDBTransactionMode,
  act: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(DB_NAME, 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore(STORE);
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      try {
        const request = act(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (cause) {
        reject(cause);
      } finally {
        // Closes once the transaction is done.
        db.close();
      }
    };
  });
}

const getImage = (key: string) =>
  withStore<Blob | undefined>("readonly", (store) => store.get(key));
const putImage = (key: string, blob: Blob) =>
  withStore("readwrite", (store) => store.put(blob, key));
const deleteImage = (key: string) => withStore("readwrite", (store) => store.delete(key));
