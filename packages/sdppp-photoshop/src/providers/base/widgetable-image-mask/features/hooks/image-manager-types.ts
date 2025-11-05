import type { BoundarySetting, ContentType, TrackType } from '../../foundation/stores/types';

export interface UseImageManagerOptions {
  componentId: string;
  maxCount: number;
  isMask: boolean;
  urls: string[];
  onValueChange: (urls: string[]) => void;
}

export interface SlotViewModel {
  index: number;
  imageUrl: string;
  primaryAuto: boolean;
  primaryContent: ContentType | null;
  primaryLayerIdentify: string | null;
  primaryBoundary: BoundarySetting;
  primaryAlt: boolean;
  primaryTrackType: TrackType | null;
  maskAuto: boolean;
  uploading: boolean;
  hasPrimary: boolean;
  hasMask: boolean;
  compositeDirty: boolean;
}

export interface UseImageManagerReturn {
  slots: SlotViewModel[];
  onPrimarySync: (index: number) => Promise<void>;
  onMaskSync: (index: number) => Promise<void>;
  onAdvancedSelect: (index: number) => Promise<void>;
  onAdvancedCancel: (index: number) => void;
  onPrimaryAutoToggle: (index: number, enable: boolean) => void;
  onMaskAutoToggle: (index: number, enable: boolean) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  uploading: boolean;
  uploadError: string;
  showAddRemove: boolean;
}
