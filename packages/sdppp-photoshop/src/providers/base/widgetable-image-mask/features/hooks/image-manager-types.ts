export interface UseImageManagerOptions {
  componentId: string;
  maxCount: number;
  isMask: boolean;
  urls: string[];
  onValueChange: (urls: string[]) => void;
}

export interface UseImageManagerReturn {
  slots: number[];
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
