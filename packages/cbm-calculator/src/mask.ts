import { normalizeRect } from './geometry';
import type { MaskSnapshot, Snapshot, StageRect } from './types';

const createMaskSnapshotRect = (rect: StageRect | null, fallback: StageRect): StageRect =>
  rect ? normalizeRect(rect) : normalizeRect(fallback);

type MaskApplicationParams = {
  maskSnapshot?: MaskSnapshot | null;
  invertMask?: boolean;
};

type MaskApplicationStats = {
  totalPixels: number;
  maskedPixels: number;
  unmaskedPixels: number;
  maskAlphaZeroPixels: number;
  maskAlphaNonZeroPixels: number;
  invertMaskApplied: boolean;
  alphaRemovalTotal: number;
  alphaRemovalAverage: number;
  alphaRemovalAverageNormalized: number;
  alphaRemovalMax: number;
  stronglyMaskedPixels: number;
};

export const applyMaskToSnapshot = async (
  snapshot: Snapshot,
  params: MaskApplicationParams = {}
): Promise<{ snapshot: Snapshot; stats: MaskApplicationStats }> => {
  const maskSnapshot = params.maskSnapshot ?? null;

  if (!maskSnapshot) {
    const totalPixels = Math.max(1, Math.round(snapshot.rect.width)) * Math.max(1, Math.round(snapshot.rect.height));
    return {
      snapshot,
      stats: {
        totalPixels,
        maskedPixels: 0,
        unmaskedPixels: totalPixels,
        maskAlphaZeroPixels: 0,
        maskAlphaNonZeroPixels: 0,
        invertMaskApplied: false,
      },
    };
  }

  const baseRect = normalizeRect(snapshot.rect);
  const baseImage = snapshot.image.clone();
  const width = Math.max(1, baseImage.bitmap.width);
  const height = Math.max(1, baseImage.bitmap.height);
  const data = baseImage.bitmap.data;

  let maskImage = maskSnapshot ? maskSnapshot.image.clone() : null;
  let maskSnapshotRect = maskSnapshot ? normalizeRect(maskSnapshot.maskRegion ?? maskSnapshot.rect) : null;

  if (
    maskImage &&
    (maskImage.bitmap.width !== width || maskImage.bitmap.height !== height || !maskSnapshotRect)
  ) {
    maskImage = maskImage
      .clone()
      .resize({
        w: width,
        h: height,
      });
    maskSnapshotRect = { ...baseRect };
  }

  const maskData = maskImage ? maskImage.bitmap.data : null;
  const maskWidth = maskImage?.bitmap.width ?? 0;
  const maskHeight = maskImage?.bitmap.height ?? 0;

  const snapshotMaskRect = maskSnapshotRect ? createMaskSnapshotRect(maskSnapshotRect, baseRect) : null;
  const invertMask = Boolean(params.invertMask);

  let maskedPixels = 0;
  let maskAlphaZeroPixels = 0;
  let maskAlphaNonZeroPixels = 0;
  let alphaRemovalTotal = 0;
  let alphaRemovalMax = 0;
  let stronglyMaskedPixels = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const globalX = baseRect.x + x;
      const globalY = baseRect.y + y;

      let maskValue = 0;

      if (maskData && snapshotMaskRect) {
        const relativeX = globalX - snapshotMaskRect.x;
        const relativeY = globalY - snapshotMaskRect.y;
        if (
          relativeX >= 0 &&
          relativeY >= 0 &&
          relativeX < snapshotMaskRect.width &&
          relativeY < snapshotMaskRect.height
        ) {
          const sampleX = Math.min(
            maskWidth - 1,
            Math.max(0, Math.floor((relativeX / Math.max(1, snapshotMaskRect.width)) * maskWidth))
          );
          const sampleY = Math.min(
            maskHeight - 1,
            Math.max(0, Math.floor((relativeY / Math.max(1, snapshotMaskRect.height)) * maskHeight))
          );
          const maskIdx = (sampleY * maskWidth + sampleX) * 4;
          const alpha = maskData[maskIdx + 3];
          if (alpha <= 0) {
            maskAlphaZeroPixels += 1;
          } else {
            maskAlphaNonZeroPixels += 1;
          }
          let normalizedAlpha = Math.min(1, Math.max(0, alpha / 255));
          normalizedAlpha = 1 - normalizedAlpha;
          const effectiveAlpha = maskSnapshot?.reverse ? 1 - normalizedAlpha : normalizedAlpha;
          const normalizedMask = Math.min(1, Math.max(0, effectiveAlpha));
          maskValue = Math.max(maskValue, normalizedMask);
        }
      }

      let removal = Math.min(1, maskValue);
      if (invertMask) {
        removal = Math.max(0, 1 - removal);
      }
      if (removal <= 0) continue;
      maskedPixels += 1;
      const previousAlpha = data[idx + 3];
      const nextAlpha = Math.max(0, Math.round(previousAlpha * (1 - removal)));
      const alphaReduction = Math.max(0, previousAlpha - nextAlpha);
      alphaRemovalTotal += alphaReduction;
      alphaRemovalMax = Math.max(alphaRemovalMax, alphaReduction);
      if (alphaReduction >= 128) {
        stronglyMaskedPixels += 1;
      }
      data[idx + 3] = nextAlpha;
    }
  }

  const totalPixels = width * height;
  maskedPixels = Math.max(0, Math.min(totalPixels, maskedPixels));
  const unmaskedPixels = Math.max(0, Math.min(totalPixels, totalPixels - maskedPixels));
  const alphaRemovalAverage = totalPixels > 0 ? alphaRemovalTotal / totalPixels : 0;
  const alphaRemovalAverageNormalized = Math.max(0, Math.min(1, alphaRemovalAverage / 255));

  return {
    snapshot: {
      image: baseImage,
      rect: baseRect,
    },
    stats: {
      totalPixels,
      maskedPixels,
      unmaskedPixels,
      maskAlphaZeroPixels,
      maskAlphaNonZeroPixels,
      invertMaskApplied: invertMask,
      alphaRemovalTotal,
      alphaRemovalAverage,
      alphaRemovalAverageNormalized,
      alphaRemovalMax,
      stronglyMaskedPixels,
    },
  };
};
