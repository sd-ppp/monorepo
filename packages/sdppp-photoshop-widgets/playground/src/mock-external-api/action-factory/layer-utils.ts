import type { Stage as KonvaStage } from 'konva/lib/Stage';

import { intersectRect, normalizeRect, type StageRect } from '@sdppp/cbm-calculator';
import { fullStageRect } from './stage-utils';

const roundRect = (rect: { x: number; y: number; width: number; height: number }): StageRect =>
  normalizeRect({
    x: Number.isFinite(rect.x) ? rect.x : 0,
    y: Number.isFinite(rect.y) ? rect.y : 0,
    width: Number.isFinite(rect.width) ? rect.width : 0,
    height: Number.isFinite(rect.height) ? rect.height : 0,
  });

export const resolveLayerRect = (stage: KonvaStage, layerId: string | null | undefined): StageRect | null => {
  const trimmed = typeof layerId === 'string' ? layerId.trim() : '';
  if (!trimmed) return null;

  const node = stage.findOne(node => typeof node.id === 'function' && node.id() === trimmed);
  if (!node) return null;

  const clientRect = node.getClientRect({ relativeTo: stage, skipShadow: true });
  const normalized = roundRect({
    x: clientRect.x,
    y: clientRect.y,
    width: clientRect.width,
    height: clientRect.height,
  });

  const bounded = intersectRect(fullStageRect(stage), normalized);
  return bounded ? normalizeRect(bounded) : null;
};
