import type {
  FileResourceCreateByContentParams,
  FileResourceMaterializeResult,
} from '../../../src/context/PhotoshopWidgetContext';
import type { ActionContext } from './types';
import {
  createErrorLogger,
  materializeSnapshot,
  maybeSimulateDelay,
  resolveContentSnapshot,
} from './cbm-helpers';

export const createByContent = async (
  ctx: ActionContext,
  params: FileResourceCreateByContentParams
): Promise<FileResourceMaterializeResult> => {
  const scopeLog = createErrorLogger(ctx, 'mock resource.file.createByContent');
  try {
    await maybeSimulateDelay();
    const snapshot = await resolveContentSnapshot(ctx, params.contentUri, scopeLog);
    return await materializeSnapshot(ctx, snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    scopeLog('failed', error, {
      contentUri: params.contentUri,
    });
    return { resource: null, error: message };
  }
};
