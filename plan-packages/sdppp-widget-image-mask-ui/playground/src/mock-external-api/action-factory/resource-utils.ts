import type { FileResourceMaterializeResult } from '../../../src/context/WidgetImageMaskContext';
import { MockResourceStore, type StageRect } from '../resource-store';
import type { MaskSnapshot, Snapshot } from './types';

export const snapshotToResource = (
  snapshot: Snapshot | MaskSnapshot,
  store: MockResourceStore,
  options?: { maskRegion?: StageRect | null }
): FileResourceMaterializeResult => {
  const record = store.createFromDataUrl(snapshot.dataUrl, {
    width: snapshot.rect.width,
    height: snapshot.rect.height,
    mime: 'image/png',
    rect: snapshot.rect,
    maskRegion: options?.maskRegion ?? null,
  });
  return {
    resource: record.resource,
    thumbnail: record.dataUrl,
    width: record.width,
    height: record.height,
    mime: record.mime,
  };
};
