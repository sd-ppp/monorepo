import type {
  FileResourceCombineByCBMParams,
  FileResourceMaterializeResult,
} from '../../../src/context/PhotoshopWidgetContext';
import { applyMaskToSnapshot, cropSnapshot, ensurePositiveRect } from '@sdppp/cbm-calculator';
import { parseBoundaryRect } from './boundary-utils';
import type { ActionContext, Snapshot } from './types';
import {
  createErrorLogger,
  materializeSnapshot,
  maybeSimulateDelay,
  resolveContentSnapshot,
  resolveMaskSnapshot,
} from './cbm-helpers';

export const combineByCBM = async (
  ctx: ActionContext,
  params: FileResourceCombineByCBMParams
): Promise<FileResourceMaterializeResult> => {
  ctx.logger(
    'mock resource.file.combineByCBM',
    `boundary=${params.boundaryUri ?? 'null'}`,
    `mask=${params.maskUri ?? 'null'}`
  );

  const logError = createErrorLogger(ctx, 'mock resource.file.combineByCBM');

  try {
    await maybeSimulateDelay();
    const boundaryRect = params.boundaryUri
      ? ensurePositiveRect(parseBoundaryRect(ctx, params.boundaryUri))
      : null;

    const contentSnapshot = await resolveContentSnapshot(ctx, params.contentUri, logError);
    const maskSnapshot = await resolveMaskSnapshot(ctx, params.maskUri ?? undefined, logError);

    let combinedSnapshot: Snapshot;
    let maskStats;
    try {
      const applied = await applyMaskToSnapshot(contentSnapshot, {
        maskSnapshot,
      });
      combinedSnapshot = applied.snapshot;
      maskStats = applied.stats;

      ctx.logger(
        '[MaskDebug] 预览遮罩统计',
        JSON.stringify({
          requestMaskUri: params.maskUri ?? null,
          effectiveReverse: maskSnapshot?.reverse ?? false,
          totalPixels: maskStats.totalPixels,
          maskedPixels: maskStats.maskedPixels,
          maskAlphaNonZeroPixels: maskStats.maskAlphaNonZeroPixels,
          maskAlphaZeroPixels: maskStats.maskAlphaZeroPixels,
        })
      );
    } catch (error) {
      logError('applyMaskToSnapshot', error, {
        hasMaskSnapshot: Boolean(maskSnapshot),
      });
      throw error;
    }

    const boundedSnapshot = boundaryRect ? await cropSnapshot(combinedSnapshot, boundaryRect) : combinedSnapshot;
    try {
      return await materializeSnapshot(ctx, boundedSnapshot);
    } catch (error) {
      logError('snapshotToResource', error, {
        rect: boundedSnapshot.rect,
      });
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('failed', error, {
      boundaryUri: params.boundaryUri ?? null,
      contentUri: params.contentUri ?? null,
      maskUri: params.maskUri ?? null,
    });
    return { resource: null, error: message };
  }
};
