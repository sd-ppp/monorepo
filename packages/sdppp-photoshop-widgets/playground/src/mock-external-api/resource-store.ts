import type { StageRect } from '@sdppp/cbm-calculator';
import type { FileUri } from 'sdppp-photoshop-widgets/hooks/useThumbnail/types';

export interface StoredResource {
  resource: FileUri;
  dataUrl: string;
  width: number;
  height: number;
  mime: string;
  rect: StageRect;
  maskRegion?: StageRect | null;
}

const createFileUri = (): FileUri => {
  const id =
    typeof globalThis !== 'undefined' &&
    globalThis.crypto &&
    'randomUUID' in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `uxp://file/${id}` as FileUri;
};

export class MockResourceStore {
  private readonly resources = new Map<FileUri, StoredResource>();

  createFromDataUrl(
    dataUrl: string,
    meta: { width: number; height: number; mime?: string; rect?: StageRect; maskRegion?: StageRect | null }
  ): StoredResource {
    const resource = createFileUri();
    const record: StoredResource = {
      resource,
      dataUrl,
      width: meta.width,
      height: meta.height,
      mime: meta.mime ?? 'image/png',
      rect:
        meta.rect ?? {
          x: 0,
          y: 0,
          width: meta.width,
          height: meta.height,
        },
      maskRegion: meta.maskRegion ?? null,
    };
    this.resources.set(resource, record);
    return record;
  }

  get(resource: string | null | undefined): StoredResource | undefined {
    if (!resource) return undefined;
    return this.resources.get(resource as FileUri);
  }

  getThumbnail(resource: string | null | undefined): string | null {
    if (!resource) return null;
    const existing = this.get(resource);
    if (existing) return existing.dataUrl;
    return null;
  }

  getSnapshot(resource: string | null | undefined): (StoredResource & { resource: FileUri }) | null {
    const stored = this.get(resource);
    return stored ?? null;
  }
}
