import { normalizeRect } from './geometry';
import { createSolidColorImage } from './image';
import { createSnapshot } from './snapshot';
import type { Snapshot, StageRect } from './types';

export const createSolidMaskSnapshot = async (
  rect: StageRect,
  options?: { color?: string }
): Promise<Snapshot> => {
  const normalized = normalizeRect(rect);
  const image = await createSolidColorImage(normalized, options?.color ?? 'rgba(0,0,0,1)');
  return createSnapshot(image, normalized);
};

export const isEmptyMaskUri = (maskUri?: string | null): boolean => {
  if (typeof maskUri !== 'string') return true;
  return /\/empty(?:\/|\?|#|$)/.test(maskUri.trim());
};
