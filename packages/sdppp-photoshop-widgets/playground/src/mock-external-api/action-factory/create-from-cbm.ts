import type { FileResourceCreateFromCBMParams, FileResourceMaterializeResult } from '../../../src/context/WidgetImageMaskContext';
import { createContentSnapshot, resolveContentRect } from './content-utils';
import { createMaskSnapshot, resolveMaskRect, resolveMaskSnapshotFromResource, applyMaskToSnapshot } from './mask-utils';
import { parseBoundaryRect } from './boundary-utils';
import { cropSnapshot, ensurePositiveRect, intersectRect, normalizeRect } from './stage-utils';
import { snapshotToResource } from './resource-utils';
import type { ActionContext } from './types';

export const createFromCBM = async (
  ctx: ActionContext,
  params: FileResourceCreateFromCBMParams
): Promise<FileResourceMaterializeResult> => {
  ctx.logger(
    'mock resource.file.createFromCBM',
    `boundary=${params.boundaryUri ?? 'null'}`,
    `mask=${params.maskUri ?? 'null'}`
  );

  try {
    const stage = ctx.getStage();
    const selection = ctx.getSelection();
    const boundaryRect = params.boundaryUri
      ? ensurePositiveRect(normalizeRect(parseBoundaryRect(stage, selection, params.boundaryUri)))
      : null;

    if (!params.contentUri) {
      const maskSnapshot = resolveMaskSnapshotFromResource(stage, params.maskUri ?? undefined, ctx.resourceStore);
      if (maskSnapshot) {
        const bounded = boundaryRect ? await cropSnapshot(maskSnapshot, boundaryRect) : maskSnapshot;
        const originalRegion = maskSnapshot.maskRegion ?? null;
        const effectiveRegion = originalRegion
          ? boundaryRect
            ? intersectRect(originalRegion, boundaryRect)
            : originalRegion
          : null;
        return snapshotToResource(bounded, ctx.resourceStore, {
          maskRegion: effectiveRegion ? normalizeRect(effectiveRegion) : null,
        });
      }

      const maskRect = resolveMaskRect(stage, params.maskUri ?? undefined, selection, ctx.resourceStore);
      return await createMaskSnapshot(stage, ctx.resourceStore, maskRect ?? null, boundaryRect ?? null);
    }

    const contentRect = resolveContentRect(stage, params.contentUri, selection);
    const contentSnapshot = createContentSnapshot(stage, contentRect);
    const maskSnapshot = resolveMaskSnapshotFromResource(stage, params.maskUri ?? undefined, ctx.resourceStore);
    const maskedSnapshot = await applyMaskToSnapshot(
      contentSnapshot,
      resolveMaskRect(stage, params.maskUri ?? undefined, selection, ctx.resourceStore),
      maskSnapshot
    );
    const boundedSnapshot = boundaryRect ? await cropSnapshot(maskedSnapshot, boundaryRect) : maskedSnapshot;
    return snapshotToResource(boundedSnapshot, ctx.resourceStore);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.logger('mock resource.file.createFromCBM failed', message);
    return { resource: null, error: message };
  }
};
