import type {
  BoundaryRect as BaseBoundaryRect,
  BoundarySetting as BaseBoundarySetting,
  ContentType as BaseContentType,
  TrackType as BaseTrackType,
} from '../../../realtime-thumbnail/types';

export type ContentType = BaseContentType;
export type TrackType = BaseTrackType;

export type BoundaryRect = BaseBoundaryRect;
export type BoundarySetting = BaseBoundarySetting;

export interface AutoSyncConfig {
  type: TrackType;
  content: ContentType;
  alt?: boolean;
  layerIdentify?: string | null;
  boundary?: BoundarySetting;
}

export interface SlotState {
  primaryTrackType?: TrackType | null;
  primaryContent?: ContentType | null;
  primaryLayerIdentify?: string | null;
  primaryBoundary?: BoundarySetting;
  primaryAlt?: boolean;
  thumbnail?: string;
  uploading?: boolean;
  uploadId?: string | null;
  primaryResourceId?: string | null;
  maskResourceId?: string | null;
  compositeThumbnail?: string;
  compositeDirty?: boolean;
  compositeResourceId?: string | null;
  maskAutoEnabled?: boolean;
}

export interface ImageComponentState {
  id: string;
  maxCount: number;
  isMask: boolean;
  urls: string[];
  slots: Record<number, SlotState>;
}

export const getSlotPrimaryConfig = (slot?: SlotState | null): AutoSyncConfig | null => {
  if (!slot || !slot.primaryTrackType || !slot.primaryContent) {
    return null;
  }

  const config: AutoSyncConfig = {
    type: slot.primaryTrackType,
    content: slot.primaryContent,
    layerIdentify: slot.primaryLayerIdentify ?? null,
    boundary: slot.primaryBoundary ?? null,
  };

  if (typeof slot.primaryAlt === 'boolean') {
    config.alt = slot.primaryAlt;
  }

  return config;
};
