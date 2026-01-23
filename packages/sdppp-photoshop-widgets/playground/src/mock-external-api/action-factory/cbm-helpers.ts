import type { FileResourceMaterializeResult } from '../../../src/context/PhotoshopWidgetContext';
import { createContentSnapshot, resolveContentArea } from './content-utils';
import { resolveMaskSnapshotFromResource } from './mask-utils';
import { dataUrlToBytes } from './data-utils';
import { snapshotFromSource } from '@sdppp/cbm-calculator';
import type { ActionContext, MaskSnapshot, Snapshot } from './types';
import { isEmptyMaskUri } from '@sdppp/cbm-calculator';
import { snapshotToResource } from './resource-utils';

export const maybeSimulateDelay = async (): Promise<void> => {
  if (typeof setTimeout === 'function') {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
};

export const createErrorLogger =
  (ctx: ActionContext, scope: string) =>
  (label: string, error: unknown, extra?: Record<string, unknown>) => {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    ctx.logger(
      `${scope} ${label}`,
      JSON.stringify({
        message,
        stack,
        ...extra,
      })
    );
  };

export const resolveContentSnapshot = async (
  ctx: ActionContext,
  contentUri: string,
  logError: (label: string, error: unknown, extra?: Record<string, unknown>) => void
): Promise<Snapshot> => {
  const stage = ctx.getStage();
  const selection = ctx.getSelection();
  const currentLayerId = ctx.getCurrentLayerId();

  const storedSnapshot =
    contentUri && !contentUri.startsWith('uxp://content/')
      ? ctx.resourceStore.getSnapshot(contentUri)
      : null;

  if (storedSnapshot) {
    const storedData = dataUrlToBytes(storedSnapshot.dataUrl);
    return snapshotFromSource(storedData.bytes, storedSnapshot.rect, { mimeType: storedData.mimeType });
  }

  const { rect: contentRect, layerId: contentLayerId } = resolveContentArea(
    stage,
    contentUri,
    selection,
    currentLayerId
  );
  try {
    return await createContentSnapshot(stage, contentRect, { isolateLayerId: contentLayerId });
  } catch (error) {
    logError('createContentSnapshot', error, {
      contentUri,
      contentRect,
      contentLayerId,
    });
    throw error;
  }
};

export const resolveMaskSnapshot = async (
  ctx: ActionContext,
  maskUri: string | undefined,
  logError: (label: string, error: unknown, extra?: Record<string, unknown>) => void
): Promise<MaskSnapshot | null> => {
  const stage = ctx.getStage();
  try {
    return await resolveMaskSnapshotFromResource(stage, maskUri, ctx.resourceStore);
  } catch (error) {
    logError('resolveMaskSnapshotFromResource', error, {
      maskUri: maskUri ?? null,
    });
    throw error;
  }
};

export const materializeSnapshot = async (
  ctx: ActionContext,
  snapshot: Snapshot | MaskSnapshot
): Promise<FileResourceMaterializeResult> => snapshotToResource(snapshot, ctx.resourceStore);
