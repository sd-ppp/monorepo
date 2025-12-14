import type { MutableRefObject } from 'react';
import type { Stage as KonvaStage } from 'konva/lib/Stage';

import type { MaskSnapshot, Snapshot, StageRect } from '@sdppp/cbm-calculator';
import type { PhotoshopWidgetLogger } from '../../../src/context/PhotoshopWidgetContext';
import type { SelectionRect } from '../types';
import { MockResourceStore } from '../resource-store';

export interface FactoryDeps {
  stageRef: MutableRefObject<KonvaStage | null>;
  selectionRef: MutableRefObject<SelectionRect | null>;
  resourceStore: MockResourceStore;
  currentLayerIdRef: MutableRefObject<string | null>;
  logger: PhotoshopWidgetLogger;
}

export interface ActionContext {
  getStage: () => KonvaStage;
  getSelection: () => SelectionRect | null;
  getCurrentLayerId: () => string | null;
  resourceStore: MockResourceStore;
  logger: PhotoshopWidgetLogger;
}

export type { StageRect, SelectionRect, MockResourceStore, Snapshot, MaskSnapshot };
