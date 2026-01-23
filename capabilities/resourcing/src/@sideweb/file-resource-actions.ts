import { sdpppSDK } from '@sdppp/common';

import {
  sidewebResourceHandleRegistry,
  type ResourceHandle,
} from './resource-handles';

export interface FileResourceMaterializeRecord {
  resource?: string | null;
  handle?: ResourceHandle | null;
  thumbnail?: string | null;
  width?: number | null;
  height?: number | null;
  mime?: string | null;
  nativePath?: string | null;
  error?: string | null;
  [key: string]: unknown;
}

export interface FileResourceMaterializeResult extends FileResourceMaterializeRecord {
  batch?: FileResourceMaterializeRecord[] | null;
}

type FileResourceActionName =
  | 'fileResource.createFromExternal'
  | 'fileResource.createFromLocal'
  | 'fileResource.createFromBuffer'
  | 'fileResource.createByContent'
  | 'fileResource.createByMask'
  | 'fileResource.combineByCBM';

type PhotoshopActionsLike = Record<string, (...args: any[]) => any> | undefined;

const getPhotoshopActions = (): PhotoshopActionsLike => {
  return sdpppSDK?.plugins?.photoshop as PhotoshopActionsLike;
};

const normalizeResourceId = (value?: string | null): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const attachHandleToRecord = (
  record: FileResourceMaterializeRecord | null | undefined,
): FileResourceMaterializeRecord | null | undefined => {
  if (!record) return record;

  const rawResource = record.resource;
  const normalizedResource =
    typeof rawResource === 'string' ? normalizeResourceId(rawResource) : normalizeResourceId(null);
  const resourceChanged =
    typeof rawResource === 'string' && normalizedResource !== null && normalizedResource !== rawResource;
  const existingHandle = record.handle ?? null;
  const handle =
    existingHandle ??
    (normalizedResource ? sidewebResourceHandleRegistry.track(normalizedResource) : null);

  if (!resourceChanged && handle === existingHandle) {
    return record;
  }

  return {
    ...record,
    resource: resourceChanged ? normalizedResource : rawResource,
    handle,
  };
};

const attachHandles = <T extends FileResourceMaterializeResult | null | undefined>(
  result: T,
): T => {
  if (!result) return result;

  const baseRecord = attachHandleToRecord(result) as FileResourceMaterializeResult;
  const nextBatch = Array.isArray(result.batch)
    ? result.batch.map(entry => attachHandleToRecord(entry) ?? entry)
    : result.batch;

  const baseUpdated = baseRecord !== result;
  const batchUpdated = nextBatch !== result.batch;

  if (!baseUpdated && !batchUpdated) {
    return result;
  }

  const merged: FileResourceMaterializeResult = {
    ...(result as FileResourceMaterializeResult),
    ...(baseUpdated ? baseRecord : {}),
  };

  if (batchUpdated) {
    merged.batch = nextBatch as FileResourceMaterializeRecord[] | null | undefined;
  }

  return merged as T;
};

const unavailableResult = (action: FileResourceActionName): FileResourceMaterializeResult => ({
  error: `${action} unavailable`,
});

const errorResult = (
  action: FileResourceActionName,
  error: unknown,
): FileResourceMaterializeResult => {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error);
  return {
    error: message,
  };
};

const invokeWithHandles = async (
  actionName: FileResourceActionName,
  params?: unknown,
): Promise<FileResourceMaterializeResult | null | undefined> => {
  const actions = getPhotoshopActions();
  const fn = actions?.[actionName];
  if (typeof fn !== 'function') {
    return unavailableResult(actionName);
  }

  try {
    const result = await fn(params);
    return attachHandles(result);
  } catch (error) {
    return errorResult(actionName, error);
  }
};

export const createFileResourceFromExternal = async (
  params?: unknown,
) => invokeWithHandles('fileResource.createFromExternal', params);

export const createFileResourceFromLocal = async (
  params?: unknown,
) => invokeWithHandles('fileResource.createFromLocal', params);

export const createFileResourceFromBuffer = async (
  params?: unknown,
) => invokeWithHandles('fileResource.createFromBuffer', params);

export const createFileResourceByContent = async (
  params?: unknown,
) => invokeWithHandles('fileResource.createByContent', params);

export const createFileResourceByMask = async (
  params?: unknown,
) => invokeWithHandles('fileResource.createByMask', params);

export const combineFileResourceByCBM = async (
  params?: unknown,
) => invokeWithHandles('fileResource.combineByCBM', params);
