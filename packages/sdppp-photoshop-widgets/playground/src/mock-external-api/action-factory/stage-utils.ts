import Konva from 'konva';
import type { Stage as KonvaStage } from 'konva/lib/Stage';

import { normalizeRect, snapshotFromSource } from '@sdppp/cbm-calculator';
import { dataUrlToBytes } from './data-utils';
import type { Snapshot, StageRect } from './types';

export const fullStageRect = (stage: KonvaStage): StageRect =>
  normalizeRect({ x: 0, y: 0, width: stage.width(), height: stage.height() });

export const logMaskSnapshotStats = (snapshot: Snapshot | null, meta?: Record<string, unknown>) => {
  if (!snapshot?.image?.bitmap?.data) return;
  try {
    const { data, width, height } = snapshot.image.bitmap;
    let maskPixels = 0;
    let nonMaskPixels = 0;
    let alphaZeroPixels = 0;
    let alphaNonZeroPixels = 0;

    for (let idx = 0; idx < data.length; idx += 4) {
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const alpha = data[idx + 3];
      if (alpha <= 0) {
        alphaZeroPixels += 1;
      } else {
        alphaNonZeroPixels += 1;
      }
      const gray = Math.round((r + g + b) / 3);
      const normalized = Math.min(1, Math.max(0, (gray / 255) * (alpha / 255)));
      if (normalized > 0) {
        maskPixels += 1;
      } else {
        nonMaskPixels += 1;
      }
    }

    console.log('[Konva] mask snapshot stats', {
      rect: snapshot.rect,
      totalPixels: width * height,
      maskPixels,
      nonMaskPixels,
      alphaZeroPixels,
      alphaNonZeroPixels,
      ...(meta ?? {}),
    });
  } catch (error) {
    console.warn('[Konva] failed to inspect mask snapshot', {
      error: error instanceof Error ? error.message : String(error),
      ...(meta ?? {}),
    });
  }
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

export const captureStageArea = async (
  stage: KonvaStage,
  rect: StageRect | null,
  includeSelectionOverlay = false,
  options?: { isolateLayerId?: string | null }
): Promise<Snapshot> => {
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
      const type =
        typeof (node as { getType?: () => string }).getType === 'function'
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

  const { bytes, mimeType } = dataUrlToBytes(dataUrl);
  return snapshotFromSource(bytes, target, { mimeType, signal: options?.signal });
};

const isSelectionOverlay = (node: any): boolean =>
  typeof node.hasName === 'function' && node.hasName('selection-overlay');

const forceFill = (node: any, color: string) => {
  if (typeof node.fill === 'function') node.fill(color);
  if (typeof node.stroke === 'function') node.stroke(color);
  if (typeof node.opacity === 'function') node.opacity(1);
  if (typeof node.fillEnabled === 'function') node.fillEnabled(true);
  if (typeof node.strokeEnabled === 'function') node.strokeEnabled(false);
  if (typeof node.dash === 'function') node.dash([]);
  if (typeof node.dashEnabled === 'function') node.dashEnabled(false);
  if (typeof node.globalCompositeOperation === 'function') node.globalCompositeOperation('source-over');
};

export const captureSelectionMask = async (stage: KonvaStage, rect: StageRect | null): Promise<Snapshot | null> => {
  const clone = cloneStage(stage);
  const overlays = clone.find('.selection-overlay');
  try {
    const overlayNodes: any[] = (() => {
      if (Array.isArray(overlays)) return overlays;
      if (typeof (overlays as { toArray?: () => any[] }).toArray === 'function') {
        return (overlays as { toArray: () => any[] }).toArray();
      }
      if (typeof (overlays as { each?: (cb: (node: any) => void) => void }).each === 'function') {
        const collected: any[] = [];
        (overlays as { each: (cb: (node: any) => void) => void }).each(node => collected.push(node));
        return collected;
      }
      if (overlays && typeof (overlays as { length?: number }).length === 'number') {
        const collected: any[] = [];
        for (let i = 0; i < (overlays as { length: number }).length; i += 1) {
          const candidate = (overlays as { [key: number]: any })[i];
          if (candidate) collected.push(candidate);
        }
        return collected;
      }
      return [];
    })();
    console.log(
      '[Konva] selection overlays detected',
      overlayNodes.length,
      overlayNodes.map(node => ({
        type:
          typeof (node as { getType?: () => string }).getType === 'function'
            ? (node as { getType: () => string }).getType()
            : undefined,
        className:
          typeof (node as { getClassName?: () => string }).getClassName === 'function'
            ? (node as { getClassName: () => string }).getClassName()
            : undefined,
        visible:
          typeof (node as { isVisible?: () => boolean }).isVisible === 'function'
            ? (node as { isVisible: () => boolean }).isVisible()
            : undefined,
        opacity:
          typeof (node as { opacity?: () => number }).opacity === 'function'
            ? (node as { opacity: () => number }).opacity()
            : undefined,
        fill:
          typeof (node as { fill?: () => string | undefined }).fill === 'function'
            ? (node as { fill: () => string | undefined }).fill()
            : undefined,
        stroke:
          typeof (node as { stroke?: () => string | undefined }).stroke === 'function'
            ? (node as { stroke: () => string | undefined }).stroke()
            : undefined,
        closed:
          typeof (node as { closed?: () => boolean }).closed === 'function'
            ? (node as { closed: () => boolean }).closed()
            : undefined,
      }))
    );
  } catch (error) {
    console.warn('[Konva] selection overlay inspection failed', error);
  }

  if (!overlays.length) {
    clone.destroy();
    return null;
  }

  clone.find(node => {
    const type =
      typeof (node as { getType?: () => string }).getType === 'function'
        ? (node as { getType: () => string }).getType()
        : undefined;
    const className =
      typeof (node as { getClassName?: () => string }).getClassName === 'function'
        ? (node as { getClassName: () => string }).getClassName()
        : undefined;

    if (type === 'Stage' || type === 'Layer') {
      return false;
    }

    if (isSelectionOverlay(node)) {
      if (className === 'Line' || className === 'Rect' || className === 'Circle' || className === 'RegularPolygon') {
        forceFill(node, '#ffffff');
        node.visible(true);
      } else {
        node.visible(false);
      }
      return false;
    }

    if (typeof (node as { visible?: (visible: boolean) => unknown }).visible === 'function') {
      (node as { visible: (visible: boolean) => unknown }).visible(false);
    }
    return false;
  });

  const backgroundLayer = new Konva.Layer();
  backgroundLayer.add(
    new Konva.Rect({
      x: 0,
      y: 0,
      width: clone.width(),
      height: clone.height(),
      fill: '#000000',
    })
  );
  clone.add(backgroundLayer);
  backgroundLayer.moveToBottom();

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

  const { bytes, mimeType } = dataUrlToBytes(dataUrl);
  const snapshot = await snapshotFromSource(bytes, target, { mimeType });
  logMaskSnapshotStats(snapshot, { source: 'captureSelectionMask' });
  return snapshot;
};
