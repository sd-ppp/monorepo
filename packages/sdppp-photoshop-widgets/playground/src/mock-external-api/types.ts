import type { MutableRefObject, ReactNode } from 'react';
import type { Stage as KonvaStage } from 'konva/lib/Stage';

export type MockRealtimeContent = 'canvas' | 'curlayer' | 'selection';

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MockExternalApiRefs {
  stageRef: MutableRefObject<KonvaStage | null>;
  selectionRect: SelectionRect | null;
  updateSelectionRect: (rect: SelectionRect | null) => void;
  notifyContentChange: (content: MockRealtimeContent) => void;
}

export interface MockExternalApiPlaygroundProps extends MockExternalApiRefs {
  children: ReactNode;
  imageUrls?: string[] | null;
  onImageUrlsChange?: (next: string[]) => void;
  onRunUploadPasses?: () => Promise<UploadPassRunSummary | void>;
  registeredUploadPassCount?: number;
  lastUploadRunSummary?: UploadPassRunSummary | null;
  panelWidth?: number | string;
}

export interface UploadPassRunSummary {
  total: number;
  success: number;
  failure: number;
  timestamp: number;
}
