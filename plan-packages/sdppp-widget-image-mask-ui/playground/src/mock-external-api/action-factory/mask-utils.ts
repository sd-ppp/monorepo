import type { Stage as KonvaStage } from 'konva/lib/Stage';

import { MockResourceStore, type StageRect } from '../resource-store';
import type { SelectionRect } from '../types';
import type { FileResourceMaterializeResult } from '../../../src/context/WidgetImageMaskContext';
import type { MaskSnapshot, Snapshot } from './types';
import {
  captureStageArea,
  createSolidColorDataUrl,
  cropSnapshot,
  fullStageRect,
  intersectRect,
  loadImage,
  normalizeRect,
} from './stage-utils';

export const resolveMaskRect = (
  stage: KonvaStage,
  maskUri: string | undefined,
  selection: SelectionRect | null,
  store: MockResourceStore
): StageRect | null => {
  if (!maskUri) return null;
  try {
    if (/^uxp:\/\/file\//.test(maskUri)) {
      const stored = store.getSnapshot(maskUri);
      return stored?.maskRegion ?? null;
    }
    const url = new URL(maskUri);
    if (url.hostname !== 'mask') return null;
    const [, target] = url.pathname.split('/').filter(Boolean);
    if (!target || target === 'canvas' || target === 'curlayer' || target === 'layer') {
      return null;
    }
    if (target === 'selection' && selection) {
      return normalizeRect(selection);
    }
    return null;
  } catch {
    return null;
  }
};

export const resolveMaskSnapshotFromResource = (
  stage: KonvaStage,
  maskUri: string | undefined,
  store: MockResourceStore
): MaskSnapshot | null => {
  if (!maskUri) return null;
  if (/^uxp:\/\/file\//.test(maskUri)) {
    const stored = store.getSnapshot(maskUri);
    if (!stored) return null;
    return {
      dataUrl: stored.dataUrl,
      rect: stored.rect,
      maskRegion: stored.maskRegion ?? null,
    };
  }
  if (/^data:image\//.test(maskUri)) {
    const rect = fullStageRect(stage);
    return {
      dataUrl: maskUri,
      rect,
      maskRegion: null,
    };
  }
  return null;
};

export const applyMaskToSnapshot = async (
  snapshot: Snapshot,
  maskRect: StageRect | null,
  maskSnapshot: MaskSnapshot | null
): Promise<Snapshot> => {
  if (!maskSnapshot && !maskRect) {
    return snapshot;
  }

  const width = Math.max(1, Math.round(snapshot.rect.width));
  const height = Math.max(1, Math.round(snapshot.rect.height));
  const baseImage = await loadImage(snapshot.dataUrl);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to acquire maskable canvas context');
  ctx.drawImage(baseImage, 0, 0, width, height);

  const baseData = ctx.getImageData(0, 0, width, height);
  const data = baseData.data;

  let maskData: Uint8ClampedArray | null = null;
  let maskWidth = 0;
  let maskHeight = 0;
  let maskOffsetX = 0;
  let maskOffsetY = 0;

  if (maskSnapshot) {
    const maskImage = await loadImage(maskSnapshot.dataUrl);
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = Math.max(1, Math.round(maskSnapshot.rect.width));
    maskCanvas.height = Math.max(1, Math.round(maskSnapshot.rect.height));
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) throw new Error('Unable to acquire mask canvas context');
    maskCtx.drawImage(maskImage, 0, 0, maskCanvas.width, maskCanvas.height);
    maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
    maskWidth = maskCanvas.width;
    maskHeight = maskCanvas.height;
    maskOffsetX = Math.round(maskSnapshot.rect.x);
    maskOffsetY = Math.round(maskSnapshot.rect.y);
  }

  const effectiveMaskRect = maskRect ? normalizeRect(maskRect) : null;
  const globalRect = normalizeRect(snapshot.rect);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      const globalX = globalRect.x + x;
      const globalY = globalRect.y + y;

      let maskValue = 0;

      if (maskData) {
        const mx = globalX - maskOffsetX;
        const my = globalY - maskOffsetY;
        if (mx >= 0 && my >= 0 && mx < maskWidth && my < maskHeight) {
          const mIndex = (Math.floor(my) * maskWidth + Math.floor(mx)) * 4;
          const r = maskData[mIndex];
          const g = maskData[mIndex + 1];
          const b = maskData[mIndex + 2];
          maskValue = Math.max(maskValue, Math.round((r + g + b) / 3));
        }
      }

      if (effectiveMaskRect) {
        if (
          globalX >= effectiveMaskRect.x &&
          globalX < effectiveMaskRect.x + effectiveMaskRect.width &&
          globalY >= effectiveMaskRect.y &&
          globalY < effectiveMaskRect.y + effectiveMaskRect.height
        ) {
          maskValue = Math.max(maskValue, 255);
        }
      }

      if (maskValue <= 0) continue;
      const normalizedMask = Math.min(1, maskValue / 255);
      data[idx + 3] = Math.max(0, Math.round(data[idx + 3] * (1 - normalizedMask)));
    }
  }

  ctx.putImageData(baseData, 0, 0);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    rect: globalRect,
  };
};

export const createMaskSnapshot = async (
  stage: KonvaStage,
  store: MockResourceStore,
  whiteRegion: StageRect | null,
  boundary: StageRect | null
): Promise<FileResourceMaterializeResult> => {
  const baseRect = fullStageRect(stage);
  const canvas = document.createElement('canvas');
  canvas.width = baseRect.width;
  canvas.height = baseRect.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { resource: null, error: 'Unable to acquire mask context' };
  }
  ctx.fillStyle = 'rgba(0,0,0,1)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (whiteRegion) {
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.fillRect(whiteRegion.x, whiteRegion.y, whiteRegion.width, whiteRegion.height);
  }
  const fullSnapshot: Snapshot = {
    dataUrl: canvas.toDataURL('image/png'),
    rect: baseRect,
  };
  const croppedSnapshot = boundary ? await cropSnapshot(fullSnapshot, boundary) : fullSnapshot;
  const regionWithinBoundary = whiteRegion
    ? boundary
      ? intersectRect(whiteRegion, boundary)
      : whiteRegion
    : null;
  const effectiveRegion = regionWithinBoundary ? intersectRect(regionWithinBoundary, croppedSnapshot.rect) : null;
  const normalizedRegion = effectiveRegion ? normalizeRect(effectiveRegion) : null;
  const record = store.createFromDataUrl(croppedSnapshot.dataUrl, {
    width: croppedSnapshot.rect.width,
    height: croppedSnapshot.rect.height,
    mime: 'image/png',
    rect: croppedSnapshot.rect,
    maskRegion: normalizedRegion,
  });
  return {
    resource: record.resource,
    thumbnail: record.dataUrl,
    width: record.width,
    height: record.height,
    mime: record.mime,
  };
};
