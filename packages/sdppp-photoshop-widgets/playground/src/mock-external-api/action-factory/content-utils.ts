import type { Stage as KonvaStage } from 'konva/lib/Stage';

import type { SelectionRect } from '../types';
import type { StageRect } from '../resource-store';
import { captureStageArea, fullStageRect, normalizeRect } from './stage-utils';
import { resolveLayerRect } from './layer-utils';

export interface ResolvedContentArea {
  rect: StageRect;
  layerId: string | null;
}

const fallbackContent = (stage: KonvaStage): ResolvedContentArea => ({
  rect: fullStageRect(stage),
  layerId: null,
});

const sanitizeLayerId = (raw: string | null | undefined): string | null => {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  return trimmed.length ? trimmed : null;
};

export const resolveContentArea = (
  stage: KonvaStage,
  contentUri: string,
  selection: SelectionRect | null,
  currentLayerId?: string | null
): ResolvedContentArea => {
  try {
    const url = new URL(contentUri);
    if (url.hostname !== 'content') {
      return fallbackContent(stage);
    }
    const [, target] = url.pathname.split('/').filter(Boolean);
    if (!target || target === 'canvas') {
      return fallbackContent(stage);
    }
    if (target === 'selection' && selection) {
      return { rect: normalizeRect(selection), layerId: null };
    }
    if (target === 'curlayer' || target === 'layer') {
      const resolvedLayerId =
        sanitizeLayerId(url.searchParams.get('layername')) ??
        sanitizeLayerId(url.searchParams.get('layerid')) ??
        sanitizeLayerId(currentLayerId);
      if (resolvedLayerId) {
        const layerRect = resolveLayerRect(stage, resolvedLayerId);
        if (layerRect) {
          return { rect: fullStageRect(stage), layerId: resolvedLayerId };
        }
      }
      return fallbackContent(stage);
    }
    return fallbackContent(stage);
  } catch {
    return fallbackContent(stage);
  }
};

export const createContentSnapshot = (
  stage: KonvaStage,
  contentRect: StageRect | null,
  options?: { isolateLayerId?: string | null }
) => captureStageArea(stage, contentRect, false, options);
