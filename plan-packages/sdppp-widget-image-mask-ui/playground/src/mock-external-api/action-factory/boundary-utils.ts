import type { Stage as KonvaStage } from 'konva/lib/Stage';

import type { SelectionRect } from '../types';
import type { StageRect } from '../resource-store';
import { fullStageRect, normalizeRect } from './stage-utils';

export const parseBoundaryRect = (
  stage: KonvaStage,
  selection: SelectionRect | null,
  boundaryUri: string
): StageRect => {
  try {
    const url = new URL(boundaryUri);
    if (url.protocol !== 'uxp:' || url.hostname !== 'boundary') {
      return fullStageRect(stage);
    }
    const segments = url.pathname.split('/').filter(Boolean);
    const target = segments[1] ?? 'canvas';
    if (target === 'rect') {
      const left = Number(url.searchParams.get('leftDistance') ?? 0);
      const top = Number(url.searchParams.get('topDistance') ?? 0);
      const width = Number(url.searchParams.get('width') ?? stage.width());
      const height = Number(url.searchParams.get('height') ?? stage.height());
      return normalizeRect({ x: left, y: top, width, height });
    }
    if (target === 'selection' && selection) {
      return normalizeRect(selection);
    }
    return fullStageRect(stage);
  } catch {
    return fullStageRect(stage);
  }
};

export const normalizeBoundaryUri = (
  stage: KonvaStage,
  selection: SelectionRect | null,
  boundary: string
): string => {
  try {
    const url = new URL(boundary);
    if (url.protocol !== 'uxp:' || url.hostname !== 'boundary') return boundary;
    const segments = url.pathname.split('/').filter(Boolean);
    const docId = segments[0] ?? '0';
    const target = segments[1] ?? 'canvas';
    if (target === 'rect') return boundary;

    let rect: StageRect;
    if (target === 'selection' && selection) {
      rect = normalizeRect(selection);
    } else {
      rect = fullStageRect(stage);
    }

    const normalized = new URL(`uxp://boundary/${docId}/rect`);
    normalized.searchParams.set('leftDistance', String(rect.x));
    normalized.searchParams.set('topDistance', String(rect.y));
    normalized.searchParams.set('width', String(rect.width));
    normalized.searchParams.set('height', String(rect.height));
    return normalized.toString();
  } catch {
    return boundary;
  }
};
