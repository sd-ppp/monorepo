import type { Stage as KonvaStage } from 'konva/lib/Stage';

import { normalizeRect, type StageRect } from '@sdppp/cbm-calculator';
import type { SelectionRect } from '../types';
import type { ActionContext } from './types';
import { fullStageRect } from './stage-utils';
import { resolveLayerRect } from './layer-utils';

const sanitizeLayerId = (raw: string | null | undefined): string | null => {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  return trimmed.length ? trimmed : null;
};

const roundNumber = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
};

const boundaryRectFromParams = (stage: KonvaStage, url: URL): StageRect => {
  const stageFallback = fullStageRect(stage);
  const left = Number(url.searchParams.get('leftDistance') ?? stageFallback.x);
  const top = Number(url.searchParams.get('topDistance') ?? stageFallback.y);

  const widthParam = url.searchParams.get('width');
  const heightParam = url.searchParams.get('height');

  const width = Number(widthParam ?? stageFallback.width);
  const height = Number(heightParam ?? stageFallback.height);

  return normalizeRect({
    x: Number.isFinite(left) ? left : stageFallback.x,
    y: Number.isFinite(top) ? top : stageFallback.y,
    width: Number.isFinite(width) ? width : stageFallback.width,
    height: Number.isFinite(height) ? height : stageFallback.height,
  });
};

const rectToBoundaryUrl = (stage: KonvaStage, docId: string, rect: StageRect): string => {
  const normalized = normalizeRect(rect);
  const stageRect = fullStageRect(stage);
  const rightDistance = Math.max(0, stageRect.x + stageRect.width - (normalized.x + normalized.width));
  const bottomDistance = Math.max(0, stageRect.y + stageRect.height - (normalized.y + normalized.height));

  const next = new URL(`uxp://boundary/${docId}/rect`);
  next.searchParams.set('leftDistance', String(roundNumber(normalized.x)));
  next.searchParams.set('topDistance', String(roundNumber(normalized.y)));
  next.searchParams.set('width', String(roundNumber(normalized.width)));
  next.searchParams.set('height', String(roundNumber(normalized.height)));
  next.searchParams.set('rightDistance', String(roundNumber(rightDistance)));
  next.searchParams.set('bottomDistance', String(roundNumber(bottomDistance)));
  return next.toString();
};

export const parseBoundaryRect = (ctx: ActionContext, boundaryUri: string): StageRect => {
  const stage = ctx.getStage();
  const selection = ctx.getSelection();
  const fallback = fullStageRect(stage);

  try {
    const url = new URL(boundaryUri);
    if (url.protocol !== 'uxp:' || url.hostname !== 'boundary') {
      return fallback;
    }
    const segments = url.pathname.split('/').filter(Boolean);
    const target = segments[1] ?? 'canvas';
    if (target === 'rect') {
      return boundaryRectFromParams(stage, url);
    }
    if (target === 'selection' && selection) {
      return normalizeRect(selection);
    }
    if (target === 'layer' || target === 'curlayer') {
      const layerId =
        sanitizeLayerId(url.searchParams.get('layername')) ??
        sanitizeLayerId(url.searchParams.get('layerid')) ??
        ctx.getCurrentLayerId();
      if (!layerId) {
        ctx.logger('mock resource.file.combineByCBM boundary fallback', JSON.stringify({ reason: 'layer_id_missing', boundaryUri }));
        return fallback;
      }
      const rect = resolveLayerRect(stage, layerId);
      if (!rect) {
        ctx.logger('mock resource.file.combineByCBM boundary fallback', JSON.stringify({ reason: 'layer_rect_missing', boundaryUri, layerId }));
        return fallback;
      }
      return rect;
    }
    return fallback;
  } catch {
    return fallback;
  }
};

export const normalizeBoundaryUri = (ctx: ActionContext, boundary: string): string => {
  const stage = ctx.getStage();
  const selection = ctx.getSelection();

  try {
    const url = new URL(boundary);
    if (url.protocol !== 'uxp:' || url.hostname !== 'boundary') return boundary;
    const segments = url.pathname.split('/').filter(Boolean);
    const docId = segments[0] ?? '0';
    const target = segments[1] ?? 'canvas';
    if (target === 'rect') return boundary;

    if (target === 'selection' && selection) {
      return rectToBoundaryUrl(stage, docId, normalizeRect(selection));
    }

    if (target === 'layer' || target === 'curlayer') {
      const layerId =
        sanitizeLayerId(url.searchParams.get('layername')) ??
        sanitizeLayerId(url.searchParams.get('layerid')) ??
        ctx.getCurrentLayerId();
      const rect = resolveLayerRect(stage, layerId);
      if (rect) {
        return rectToBoundaryUrl(stage, docId, rect);
      }
      return rectToBoundaryUrl(stage, docId, fullStageRect(stage));
    }

    return rectToBoundaryUrl(stage, docId, fullStageRect(stage));
  } catch {
    return boundary;
  }
};
