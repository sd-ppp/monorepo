import Konva from 'konva';
import type { Stage as KonvaStage } from 'konva/lib/Stage';

import type { MaskSnapshot, Snapshot, StageRect } from './types';

export const normalizeRect = (rect: StageRect): StageRect => ({
  x: Math.round(rect.x),
  y: Math.round(rect.y),
  width: Math.max(1, Math.round(rect.width)),
  height: Math.max(1, Math.round(rect.height)),
});

export const fullStageRect = (stage: KonvaStage): StageRect =>
  normalizeRect({ x: 0, y: 0, width: stage.width(), height: stage.height() });

export const ensurePositiveRect = (rect: StageRect): StageRect | null => {
  if (rect.width <= 0 || rect.height <= 0) return null;
  return rect;
};

export const intersectRect = (a: StageRect, b: StageRect): StageRect | null => {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return ensurePositiveRect({ x: left, y: top, width: right - left, height: bottom - top });
};

const cloneStage = (stage: KonvaStage): KonvaStage => {
  const json = stage.toJSON();
  const container = document.createElement('div');
  return Konva.Stage.create(json, container);
};

const sanitizeLayerId = (layerId: string | null | undefined): string | null => {
  const trimmed = typeof layerId === 'string' ? layerId.trim() : '';
  return trimmed.length ? trimmed : null;
};

export const captureStageArea = (
  stage: KonvaStage,
  rect: StageRect | null,
  includeSelectionOverlay = false,
  options?: { isolateLayerId?: string | null }
): Snapshot => {
  const clone = cloneStage(stage);
  const overlays = clone.find('.selection-overlay');
  if (!includeSelectionOverlay) {
    overlays.forEach(node => node.visible(false));
  }

  const isolateLayerId = sanitizeLayerId(options?.isolateLayerId);
  if (isolateLayerId) {
    clone.find(node => {
      if (typeof node.hasName === 'function' && node.hasName('selection-overlay')) {
        node.visible(false);
        return false;
      }
      const type = typeof (node as { getType?: () => string }).getType === 'function'
        ? (node as { getType: () => string }).getType()
        : undefined;
      if (type === 'Stage' || type === 'Layer') {
        return false;
      }
      if (typeof node.id === 'function') {
        const nodeId = node.id();
        if (nodeId === isolateLayerId) {
          node.visible(true);
          return false;
        }
        if (nodeId) {
          node.visible(false);
          return false;
        }
      }
      if (typeof (node as { visible?: (visible: boolean) => unknown }).visible === 'function') {
        (node as { visible: (visible: boolean) => unknown }).visible(false);
      }
      return false;
    });
  }

  clone.batchDraw();

  const target = normalizeRect(rect ?? fullStageRect(stage));
  const dataUrl = clone.toDataURL({
    mimeType: 'image/png',
    pixelRatio: 1,
    x: target.x,
    y: target.y,
    width: target.width,
    height: target.height,
  });
  clone.destroy();

  return { dataUrl, rect: target };
};

export const cropSnapshot = async (snapshot: Snapshot, target: StageRect): Promise<Snapshot> => {
  const intersection = intersectRect(snapshot.rect, target);
  if (!intersection) {
    const fallback = normalizeRect({ x: target.x, y: target.y, width: 1, height: 1 });
    return {
      dataUrl: createSolidColorDataUrl(fallback, 'rgba(0,0,0,0)'),
      rect: fallback,
    };
  }

  const normalized = normalizeRect(intersection);
  const image = await loadImage(snapshot.dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = normalized.width;
  canvas.height = normalized.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to acquire crop canvas context');
  ctx.drawImage(
    image,
    normalized.x - Math.round(snapshot.rect.x),
    normalized.y - Math.round(snapshot.rect.y),
    normalized.width,
    normalized.height,
    0,
    0,
    normalized.width,
    normalized.height
  );

  return {
    dataUrl: canvas.toDataURL('image/png'),
    rect: normalized,
  };
};

export const createSolidColorDataUrl = (rect: StageRect, color: string): string => {
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
  }
  return canvas.toDataURL('image/png');
};

export const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });

export const snapshotToResourceRect = (
  snapshot: Snapshot | MaskSnapshot,
  preferredRect?: StageRect | null
): StageRect => normalizeRect(preferredRect ?? snapshot.rect);
