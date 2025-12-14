import type { Stage as KonvaStage } from 'konva/lib/Stage';

import { cropSnapshot, normalizeRect, snapshotFromSource, snapshotToDataUrl, type StageRect, createSolidMaskSnapshot } from '@sdppp/cbm-calculator';
import { dataUrlToBytes } from './data-utils';
import { MockResourceStore } from '../resource-store';
import type { SelectionRect } from '../types';
import type { FileResourceMaterializeResult } from '../../../src/context/PhotoshopWidgetContext';
import type { MaskSnapshot, Snapshot } from './types';
import { captureSelectionMask, fullStageRect, logMaskSnapshotStats } from './stage-utils';

export const resolveMaskRect = (
  stage: KonvaStage,
  maskUri: string | undefined,
  selection: SelectionRect | null,
  store: MockResourceStore
): StageRect | null => {
  if (!maskUri) return null;
  const normalized = maskUri.trim();
  if (!normalized) return null;
  if (normalized === 'canvas') {
    return fullStageRect(stage);
  }
  try {
    if (/^uxp:\/\/file\//.test(normalized)) {
      const stored = store.getSnapshot(normalized);
      return stored?.maskRegion ?? null;
    }
    const url = new URL(normalized);
    if (url.hostname !== 'mask') return null;
    const [, target] = url.pathname.split('/').filter(Boolean);
    if (!target || target === 'curlayer' || target === 'layer') {
      return null;
    }
    if (target === 'canvas') {
      return fullStageRect(stage);
    }
    if (target === 'selection' && selection) {
      return normalizeRect(selection);
    }
    return null;
  } catch {
    return normalized === 'canvas' ? fullStageRect(stage) : null;
  }
};

export interface ResolvedMaskSnapshot extends MaskSnapshot {
  reverse?: boolean;
}

const createCanvasMaskSnapshot = async (
  stage: KonvaStage,
  reverse?: boolean
): Promise<ResolvedMaskSnapshot> => {
  const rect = fullStageRect(stage);
  const snapshot = await createSolidMaskSnapshot(rect);
  logMaskSnapshotStats(snapshot, {
    source: 'resolveMaskSnapshotFromResource',
    origin: 'canvasMask',
    reverse,
  });
  return {
    ...snapshot,
    maskRegion: rect,
    reverse,
  };
};

export const resolveMaskSnapshotFromResource = async (
  stage: KonvaStage,
  maskUri: string | undefined,
  store: MockResourceStore
): Promise<ResolvedMaskSnapshot | null> => {
  if (!maskUri) return null;
  const normalizedMaskUri = maskUri.trim();
  if (!normalizedMaskUri) return null;
  if (normalizedMaskUri === 'canvas') {
    return createCanvasMaskSnapshot(stage);
  }
  if (/^uxp:\/\/file\//.test(normalizedMaskUri)) {
    let resourceUri = normalizedMaskUri;
    let reverse: boolean | undefined;
    try {
      const parsed = new URL(normalizedMaskUri);
      const reverseParam = parsed.searchParams.get('reverse');
      if (reverseParam != null) {
        reverse = reverseParam === '1' || reverseParam.toLowerCase() === 'true';
        parsed.searchParams.delete('reverse');
        resourceUri = parsed.toString();
      }
    } catch {
      reverse = undefined;
    }
    const stored = store.getSnapshot(resourceUri);
    if (!stored) return null;
    const storedData = dataUrlToBytes(stored.dataUrl);
    const snapshot = await snapshotFromSource(storedData.bytes, stored.rect, { mimeType: storedData.mimeType });
    logMaskSnapshotStats(snapshot, {
      source: 'resolveMaskSnapshotFromResource',
      origin: 'resourceStore',
      reverse,
    });
    return {
      ...snapshot,
      maskRegion: stored.maskRegion ?? null,
      reverse,
    };
  }

  try {
    const parsed = new URL(normalizedMaskUri);
    const reverseParam = parsed.searchParams.get('reverse');
    const reverse =
      reverseParam === '1' || reverseParam?.trim().toLowerCase() === 'true'
        ? true
        : reverseParam === '0'
          ? false
          : undefined;
    const [, target] = parsed.pathname.split('/').filter(Boolean);
    if (parsed.hostname === 'mask' && (!target || target === 'canvas')) {
      return createCanvasMaskSnapshot(stage, reverse);
    }
    if (parsed.hostname === 'mask' && target === 'selection') {
      const snapshot = await captureSelectionMask(stage, fullStageRect(stage));
      if (!snapshot) return null;
      logMaskSnapshotStats(snapshot, {
        source: 'resolveMaskSnapshotFromResource',
        origin: 'selectionCapture',
        reverse,
      });
      return {
        ...snapshot,
        maskRegion: snapshot.rect,
        reverse,
      };
    }
  } catch {
    // fall through
  }

  return null;
};


export const createMaskSnapshot = async (
  stage: KonvaStage,
  store: MockResourceStore,
   
  boundary: StageRect | null,
  log?: (...entries: string[]) => void
): Promise<FileResourceMaterializeResult> => {
  const logger = log ?? (() => undefined);
  const baseRect = fullStageRect(stage);
  const targetRect = boundary ? normalizeRect(boundary) : baseRect;

  const selectionSnapshot = await captureSelectionMask(stage, targetRect);
  if (!selectionSnapshot) {
    const empty = await createSolidMaskSnapshot(baseRect);
    const fallback = boundary ? await cropSnapshot(empty, targetRect) : empty;
    const record = store.createFromDataUrl(await snapshotToDataUrl(fallback), {
      width: fallback.rect.width,
      height: fallback.rect.height,
      mime: 'image/png',
      rect: fallback.rect,
      maskRegion: null,
    });
    return {
      resource: record.resource,
      width: record.width,
      height: record.height,
      mime: record.mime,
    };
  }

  const record = store.createFromDataUrl(await snapshotToDataUrl(selectionSnapshot), {
    width: selectionSnapshot.rect.width,
    height: selectionSnapshot.rect.height,
    mime: 'image/png',
    rect: selectionSnapshot.rect,
    maskRegion: selectionSnapshot.rect,
  });
  return {
    resource: record.resource,
    width: record.width,
    height: record.height,
    mime: record.mime,
  };
};

export { applyMaskToSnapshot } from '@sdppp/cbm-calculator';
