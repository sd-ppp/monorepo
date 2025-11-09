import type { Stage as KonvaStage } from 'konva/lib/Stage';

import type { SelectionRect } from '../types';
import type { StageRect } from '../resource-store';
import { captureStageArea, fullStageRect, normalizeRect } from './stage-utils';

export const resolveContentRect = (
  stage: KonvaStage,
  contentUri: string,
  selection: SelectionRect | null
): StageRect | null => {
  try {
    const url = new URL(contentUri);
    if (url.hostname !== 'content') {
      return fullStageRect(stage);
    }
    const [, target] = url.pathname.split('/').filter(Boolean);
    if (!target || target === 'canvas' || target === 'curlayer' || target === 'layer') {
      return fullStageRect(stage);
    }
    if (target === 'selection' && selection) {
      return normalizeRect(selection);
    }
    return fullStageRect(stage);
  } catch {
    return fullStageRect(stage);
  }
};

export const createContentSnapshot = (stage: KonvaStage, contentRect: StageRect | null) =>
  captureStageArea(stage, contentRect, false);
