import type { Jimp } from "jimp";
import type { BoundaryRect } from "../../../resource-uris.js";

interface SelectionPathPoint {
  x: number;
  y: number;
}

interface SelectionPath {
  kind: "polygon";
  points: SelectionPathPoint[];
  closed: boolean;
  antiAlias: boolean;
}

type SelectionPathLike = SelectionPath | null | undefined;

type JimpCacheMetaInput = {
  mime?: string;
  boundaryRect?: BoundaryRect | null;
  maskPath?: SelectionPathLike;
};

type JimpCacheMeta = {
  storedAt: number;
  mime?: string;
  boundaryRect?: BoundaryRect | null;
  maskPath?: SelectionPath | null;
};

type JimpCacheEntry = {
  image: Jimp;
  meta: JimpCacheMeta;
};

const jimpCache = new Map<string, JimpCacheEntry>();

const normalizeSelectionPath = (path: SelectionPathLike): SelectionPath | null => {
  if (!path) return null;
  return {
    kind: path.kind,
    closed: path.closed,
    antiAlias: path.antiAlias,
    points: path.points.map((point) => ({ x: point.x, y: point.y }))
  };
};

const cloneBoundaryRect = (rect: BoundaryRect | null | undefined): BoundaryRect | null => {
  if (rect == null) return rect ?? null;
  return {
    leftDistance: rect.leftDistance,
    topDistance: rect.topDistance,
    rightDistance: rect.rightDistance,
    bottomDistance: rect.bottomDistance,
    width: rect.width,
    height: rect.height
  };
};

export function storeJimpForResource(resourceId: string, image: Jimp, meta?: JimpCacheMetaInput): void {
  if (typeof resourceId !== "string" || !resourceId.startsWith("uxp://")) {
    return;
  }

  const entryMeta: JimpCacheMeta = {
    storedAt: Date.now(),
    mime: meta?.mime,
    boundaryRect: cloneBoundaryRect(meta?.boundaryRect ?? null),
    maskPath: normalizeSelectionPath(meta?.maskPath ?? null)
  };

  jimpCache.set(resourceId, {
    image: image.clone(),
    meta: entryMeta
  });
}

export function getJimpForResource(resourceId: string): { image: Jimp; meta: JimpCacheMeta } | undefined {
  const entry = jimpCache.get(resourceId);
  if (!entry) {
    return undefined;
  }

  const clonedBoundary = cloneBoundaryRect(entry.meta.boundaryRect ?? null);

  return {
    image: entry.image.clone(),
    meta: {
      storedAt: entry.meta.storedAt,
      mime: entry.meta.mime,
      boundaryRect: clonedBoundary,
      maskPath: normalizeSelectionPath(entry.meta.maskPath ?? null)
    }
  };
}

export function removeJimpForResource(resourceId: string): void {
  jimpCache.delete(resourceId);
}

export function clearJimpHolder(): void {
  jimpCache.clear();
}
