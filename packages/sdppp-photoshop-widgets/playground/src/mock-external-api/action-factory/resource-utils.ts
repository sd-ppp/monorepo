import { snapshotToDataUrl, type StageRect } from '@sdppp/cbm-calculator';
import type { FileResourceMaterializeResult } from '../../../src/context/PhotoshopWidgetContext';
import { MockResourceStore } from '../resource-store';
import type { MaskSnapshot, Snapshot } from './types';

export const snapshotToResource = async (
  snapshot: Snapshot | MaskSnapshot,
  store: MockResourceStore,
  options?: { maskRegion?: StageRect | null }
): Promise<FileResourceMaterializeResult> => {
  const record = store.createFromDataUrl(await snapshotToDataUrl(snapshot), {
    width: snapshot.rect.width,
    height: snapshot.rect.height,
    mime: 'image/png',
    rect: snapshot.rect,
    maskRegion: options?.maskRegion ?? null,
  });
  return {
    resource: record.resource,
    width: record.width,
    height: record.height,
    mime: record.mime,
  };
};
