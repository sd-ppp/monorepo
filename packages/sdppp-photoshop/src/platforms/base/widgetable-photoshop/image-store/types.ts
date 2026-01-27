import { sdpppSDK } from '@sdppp/common';
import {
  type BoundaryRect,
  type BoundarySetting,
  type BoundaryUri,
  type ContentType,
  type ContentUri,
  type MaskUri,
  extractDocIdFromUris,
  parseBoundaryResource,
  parseContentResource,
} from '@sdppp/resourcing/src/resource-uris';

export type TrackType = 'image' | 'mask';

export interface AutoSyncConfig {
  type: TrackType;
  docId: number;
  content: ContentType;
  layerIdentify?: string | null;
  boundary?: BoundarySetting;
}

export interface SlotState {
  primaryTrackType?: TrackType | null;
  primaryDocId?: number | null;
  contentUri?: ContentUri | null;
  boundaryUri?: BoundaryUri | null;
  maskUri?: MaskUri | null;
  fileUri?: string | null;
  primaryResourceId?: string | null;
  maskResourceId?: string | null;
  compositeDirty?: boolean;
  compositeResourceId?: string | null;
  uploading?: boolean;
  uploadId?: string | null;
  maskAutoEnabled?: boolean;
  primaryAutoEnabled?: boolean;
}

export interface ImageComponentState {
  id: string;
  maxCount: number;
  isMask: boolean;
  urls: string[];
  slots: Record<number, SlotState>;
}

export const getSlotPrimaryConfig = (slot?: SlotState | null): AutoSyncConfig | null => {
  // 仅当存在高级选图的关键 URI（contentUri 与 boundaryUri）时，才认为有配置
  if (!slot) {
    return null;
  }
  const hasAdvancedUris = !!slot.contentUri && !!slot.boundaryUri;
  if (!hasAdvancedUris) {
    return null;
  }

  const docId =
    slot.primaryDocId ??
    extractDocIdFromUris([slot.contentUri ?? null, slot.boundaryUri ?? null, slot.maskUri ?? null]) ??
    sdpppSDK?.stores?.PhotoshopStore?.getState?.()?.activeDocumentID ??
    null;

  if (docId === null || docId === undefined) {
    return null;
  }

  let content: ContentType = 'canvas';
  let layerIdentify: string | null = null;
  try {
    const parsedContent = parseContentResource(slot.contentUri as any);
    content = parsedContent.content;
    layerIdentify = parsedContent.layerIdentify ?? null;
  } catch {
    content = 'canvas';
    layerIdentify = null;
  }

  let boundary: BoundarySetting = null;
  try {
    const parsedBoundary = parseBoundaryResource(slot.boundaryUri as any);
    boundary = parsedBoundary.boundary ?? null;
  } catch {
    boundary = null;
  }

  const normalizedDocId = Math.max(0, Math.floor(docId));

  return {
    type: slot.primaryTrackType ?? 'image',
    docId: normalizedDocId,
    content,
    layerIdentify,
    boundary,
  };
};
