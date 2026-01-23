import type { StageRect } from './types';

export const normalizeRect = (rect: StageRect): StageRect => ({
  x: Math.round(rect.x),
  y: Math.round(rect.y),
  width: Math.max(1, Math.round(rect.width)),
  height: Math.max(1, Math.round(rect.height)),
});

export const ensurePositiveRect = (rect: StageRect): StageRect | null => {
  if (rect.width <= 0 || rect.height <= 0) return null;
  return rect;
};

export const intersectRect = (a: StageRect, b: StageRect): StageRect | null => {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return ensurePositiveRect({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  });
};
