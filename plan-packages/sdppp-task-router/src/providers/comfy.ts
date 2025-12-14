import { buildBoundaryUri } from '@sdppp/resourcing/src/resource-uris';
import type { TaskLike, UrlTaskHandler } from '../types.js';

function parseWorkflowName(u: URL): string {
  return u.hostname || u.pathname.replace(/^\//, '');
}

export const comfyHandler: UrlTaskHandler = async (url, data, _ctx) => {
  const workflowName = parseWorkflowName(url);
  if (!workflowName) {
    throw new Error('comfy url must be comfy://{workflowName}');
  }
  // Use internal minimal ComfyTask implementation
  const { ComfyTaskInternal } = await import('../clients/comfy.js');

  // Resolve run params
  const sizeParam = (data && typeof data.size === 'number') ? data.size : Number(url.searchParams.get('size') || '1');
  const size = Number.isFinite(sizeParam) && sizeParam > 0 ? sizeParam : 1;

  // Resolve docId and boundary from sdpppSDK if available, allow data override
  let docId: number | undefined = typeof data?.docId === 'number' ? data.docId : undefined;
  let boundary = (data && 'boundary' in data) ? (data as any).boundary : undefined;
  let sizeLimit: number | undefined;
  let imageQuality: number | undefined;
  try {
    // @ts-ignore
    const sdk = (await import('../../ps-common/sdk/sdppp-ps-sdk.js')).sdpppSDK || (globalThis as any).sdpppSDK;
    if (!docId && sdk?.stores?.PhotoshopStore?.getState) {
      docId = sdk.stores.PhotoshopStore.getState().activeDocumentID;
    }
    if (docId != null && sdk?.stores?.WebviewStore?.getState) {
      const webviewStoreState = sdk.stores.WebviewStore.getState();
      const wb = webviewStoreState.workBoundaries || {};
      if (!boundary) {
        boundary = wb[docId as number];
      }
      const sizes = webviewStoreState.workBoundaryMaxSizes || {};
      const qualities = webviewStoreState.workBoundaryImageQualities || {};
      sizeLimit = sizes[docId as number];
      imageQuality = qualities[docId as number];
    }
  } catch {
    // ignore
  }

  docId = docId ?? 0;
  boundary = boundary ?? null;
  const boundaryUri = buildBoundaryUri(docId, boundary, {
    imageSize: typeof sizeLimit === 'number' && Number.isFinite(sizeLimit) && sizeLimit > 0
      ? Math.round(sizeLimit)
      : undefined,
    imageQuality: typeof imageQuality === 'number' && Number.isFinite(imageQuality)
      ? Math.round(imageQuality)
      : undefined,
  });

  const taskInstance = new ComfyTaskInternal({ size }, workflowName, docId, boundaryUri, null);
  const task: TaskLike = {
    taskId: taskInstance.taskId,
    promise: taskInstance.promise,
    cancelable: true,
    cancel: () => taskInstance.cancel(),
  };
  return task;
};

export { parseWorkflowName };
