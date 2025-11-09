import type { MutableRefObject } from 'react';
import type { Stage as KonvaStage } from 'konva/lib/Stage';

import type { WidgetImageMaskLogger } from '../../../src/context/WidgetImageMaskContext';
import type { SelectionRect } from '../types';
import { MockResourceStore, type StageRect } from '../resource-store';

export interface Snapshot {
  dataUrl: string;
  rect: StageRect;
}

export interface MaskSnapshot extends Snapshot {
  maskRegion?: StageRect | null;
}

export interface FactoryDeps {
  stageRef: MutableRefObject<KonvaStage | null>;
  selectionRef: MutableRefObject<SelectionRect | null>;
  resourceStore: MockResourceStore;
  logger: WidgetImageMaskLogger;
}

export interface ActionContext {
  getStage: () => KonvaStage;
  getSelection: () => SelectionRect | null;
  resourceStore: MockResourceStore;
  logger: WidgetImageMaskLogger;
}

export type { StageRect, SelectionRect, MockResourceStore };
