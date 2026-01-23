import type {
  ResourceThumbnailParams,
  ResourceThumbnailResult,
  PhotoshopWidgetActions,
} from '../../../src/context/PhotoshopWidgetContext';
import { createByContent } from './create-by-content';
import { createByMask } from './create-by-mask';
import { combineByCBM } from './combine-by-cbm';
import { createFromLocal } from './create-from-local';
import { createFromBuffer } from './create-from-buffer';
import { createResourceThumbnail } from './resource-thumbnail';
import { normalizeBoundary } from './boundary-normalize';
import { resolveLayer } from './layer-resolve';
import type { FactoryDeps, ActionContext } from './types';
export { MIN_SELECTION_EDGE, roundRect } from './constants';

const createActionContext = (deps: FactoryDeps): ActionContext => ({
  getStage: () => {
    const stage = deps.stageRef.current;
    if (!stage) {
      throw new Error('Konva stage unavailable');
    }
    return stage;
  },
  getSelection: () => deps.selectionRef.current ?? null,
  getCurrentLayerId: () => deps.currentLayerIdRef.current ?? null,
  resourceStore: deps.resourceStore,
  logger: deps.logger,
});

export const createMockActions = (deps: FactoryDeps): PhotoshopWidgetActions => {
  const ctx = createActionContext(deps);

  const handleThumbnail = (params: ResourceThumbnailParams): Promise<ResourceThumbnailResult> =>
    createResourceThumbnail(ctx, params);

  return {
    'resource.layer.resolve': params => resolveLayer(ctx, params),
    'resource.boundary.normalize': payload => normalizeBoundary(ctx, payload),
    'resource.thumbnail': handleThumbnail,
    'resource.file.createByContent': params => createByContent(ctx, params),
    'resource.file.createByMask': params => createByMask(ctx, params),
    'resource.file.combineByCBM': params => combineByCBM(ctx, params),
    'resource.file.createFromBuffer': params => createFromBuffer(ctx, params),
    'resource.file.createFromLocal': params => createFromLocal(ctx, params),
  };
};

export type { FactoryDeps } from './types';
