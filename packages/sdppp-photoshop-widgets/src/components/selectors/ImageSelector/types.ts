export type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export type SourceMode = 'layer' | 'canvas' | 'file';

export interface ParsedLayerInfo {
  layerId: string | null;
  layerName: string | null;
}

export interface ModeButtonDescriptor {
  mode: SourceMode;
  icon: import('lucide-react').LucideIcon;
  activeIcon?: import('lucide-react').LucideIcon;
  tooltip: string;
}

export interface ImageSelectorProps {
  widgetableId: string;
  value: string[];
  showActionButtons?: boolean;
  workBoundary: string;
  onValueChange?: (value: string[]) => void;
  showUploadIndicator?: boolean;
  defaultAuto?: boolean;
  externalErrorDismissSignal?: number;
  onUploadStateChange?: (state: {
    status: 'idle' | 'uploading' | 'error';
    errorMessage: string | null;
    progress: { current: number; total: number };
  }) => void;
}
