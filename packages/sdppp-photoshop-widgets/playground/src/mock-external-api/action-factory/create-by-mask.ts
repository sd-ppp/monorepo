import type {
  FileResourceCreateByMaskParams,
  FileResourceMaterializeResult,
} from '../../../src/context/PhotoshopWidgetContext';
import { createMaskSnapshot } from './mask-utils';
import type { ActionContext } from './types';
import {
  createErrorLogger,
  materializeSnapshot,
  maybeSimulateDelay,
  resolveMaskSnapshot,
} from './cbm-helpers';
import { isEmptyMaskUri } from '@sdppp/cbm-calculator';

export const createByMask = async (
  ctx: ActionContext,
  params: FileResourceCreateByMaskParams
): Promise<FileResourceMaterializeResult> => {
  const scopeLog = createErrorLogger(ctx, 'mock resource.file.createByMask');
  try {
    await maybeSimulateDelay();
    const normalizedMaskUri = params.maskUri?.trim() ?? '';
    if (!normalizedMaskUri || isEmptyMaskUri(normalizedMaskUri)) {
      return { resource: null, width: null, height: null, mime: null, handle: null };
    }

    const maskSnapshot = await resolveMaskSnapshot(ctx, normalizedMaskUri, scopeLog);
    if (maskSnapshot) {
      return await materializeSnapshot(ctx, maskSnapshot);
    }

    const stage = ctx.getStage();
    const fallbackMask = await createMaskSnapshot(stage, ctx.resourceStore, null, ctx.logger);
    const { thumbnail: _discardedThumbnail, ...resource } = fallbackMask;
    return resource;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    scopeLog('failed', error, {
      maskUri: params.maskUri ?? null,
    });
    return { resource: null, error: message };
  }
};
