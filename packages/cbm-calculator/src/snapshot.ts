import type { Jimp as JimpInstance } from 'jimp';

import { intersectRect, normalizeRect } from './geometry';
import { createSolidColorImage, jimpToBuffer, jimpToDataUrl, readImage } from './image';
import type { Snapshot, StageRect } from './types';

export const createSnapshot = (image: JimpInstance, rect?: StageRect | null): Snapshot => {
  const fallback: StageRect = rect ?? {
    x: 0,
    y: 0,
    width: image.bitmap.width,
    height: image.bitmap.height,
  };
  return {
    image,
    rect: normalizeRect(fallback),
  };
};

export const cropSnapshot = async (snapshot: Snapshot, target: StageRect): Promise<Snapshot> => {
  const intersection = intersectRect(snapshot.rect, target);
  if (!intersection) {
    const fallback = normalizeRect({ x: target.x, y: target.y, width: 1, height: 1 });
    return {
      image: await createSolidColorImage(fallback, 'rgba(0,0,0,0)'),
      rect: fallback,
    };
  }

  const normalized = normalizeRect(intersection);
  const baseRect = normalizeRect(snapshot.rect);
  const rawOffsetX = Math.round(normalized.x - baseRect.x);
  const rawOffsetY = Math.round(normalized.y - baseRect.y);
  const offsetX = Math.max(0, Math.min(snapshot.image.bitmap.width - normalized.width, rawOffsetX));
  const offsetY = Math.max(0, Math.min(snapshot.image.bitmap.height - normalized.height, rawOffsetY));

  const cloned = snapshot.image.clone();
  const cropped = cloned.crop({
    x: offsetX,
    y: offsetY,
    w: normalized.width,
    h: normalized.height,
  });

  return {
    image: cropped,
    rect: normalized,
  };
};

export const snapshotToRect = (snapshot: Snapshot, preferredRect?: StageRect | null): StageRect =>
  normalizeRect(preferredRect ?? snapshot.rect);

export const snapshotToBuffer = (snapshot: Snapshot, mime?: string): Promise<Uint8Array> =>
  jimpToBuffer(snapshot.image, mime);

export const snapshotToDataUrl = (snapshot: Snapshot): Promise<string> => jimpToDataUrl(snapshot.image);

export const snapshotFromSource = async (
  source: string | ArrayBuffer | Uint8Array,
  rect?: StageRect | null,
  options?: { mimeType?: string; signal?: AbortSignal }
): Promise<Snapshot> => {
  const image = await readImage(source, options);

  const fallback: StageRect = rect ?? {
    x: 0,
    y: 0,
    width: image.bitmap.width,
    height: image.bitmap.height,
  };
  return createSnapshot(image, fallback);
};
