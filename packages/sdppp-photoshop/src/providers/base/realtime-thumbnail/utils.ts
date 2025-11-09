import type {
  BoundaryRect,
  BoundaryResource,
  BoundarySetting,
  BoundaryUri,
  ContentType,
  ContentUri,
  MaskUri,
} from './types';

const RESOURCE_BASE = 'uxp://boundary';
const IMAGE_CONTENT_BASE = 'uxp://content';
const MASK_CONTENT_BASE = 'uxp://mask';

const BOUNDARY_RESOURCE_PREFIX = 'uxp://mask';
const RECT_RESOURCE_PREFIX = `${BOUNDARY_RESOURCE_PREFIX}/rect`;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const serializeBoundaryRect = (rect: BoundaryRect): string => {
  const parts = [
    rect.leftDistance,
    rect.topDistance,
    rect.rightDistance,
    rect.bottomDistance,
    rect.width,
    rect.height,
  ].map(value => (isFiniteNumber(value) ? value : 0));
  return `${RECT_RESOURCE_PREFIX}/${parts.join(',')}`;
};

const parseRectResource = (resource: string): BoundaryRect | null => {
  if (!resource.startsWith(`${RECT_RESOURCE_PREFIX}/`)) return null;
  const [, raw] = resource.split(`${RECT_RESOURCE_PREFIX}/`);
  if (!raw) return null;
  const parts = raw.split(',');
  if (parts.length !== 6) return null;

  const numbers = parts.map(part => Number(part));
  if (numbers.some(value => Number.isNaN(value))) {
    return null;
  }

  return {
    leftDistance: numbers[0],
    topDistance: numbers[1],
    rightDistance: numbers[2],
    bottomDistance: numbers[3],
    width: numbers[4],
    height: numbers[5],
  };
};

export const boundaryResourceFromSetting = (
  boundary: BoundarySetting | undefined | null
): BoundaryResource => {
  if (!boundary) return null;
  if (boundary === 'canvas' || boundary === 'curlayer' || boundary === 'selection') {
    return `${BOUNDARY_RESOURCE_PREFIX}/${boundary}`;
  }
  return serializeBoundaryRect(boundary);
};

export const boundarySettingFromResource = (resource: BoundaryResource): BoundarySetting => {
  if (!resource) return null;
  if (!resource.startsWith(BOUNDARY_RESOURCE_PREFIX)) return resource as BoundarySetting;

  const suffix = resource.slice(BOUNDARY_RESOURCE_PREFIX.length + 1);
  if (suffix === 'canvas' || suffix === 'curlayer' || suffix === 'selection') {
    return suffix;
  }

  return parseRectResource(resource);
};

export const buildRealtimeThumbKey = (
  content: ContentType,
  layerIdentify: string | null | undefined,
  alt: boolean | undefined,
  boundaryResource: BoundaryResource
): string => {
  const base = layerIdentify ? `${content}:${layerIdentify}` : content;
  const altKey = alt ? `${base}_alt` : base;
  return boundaryResource ? `${altKey}::${boundaryResource}` : altKey;
};

export const areBoundaryResourcesEqual = (
  a: BoundaryResource,
  b: BoundaryResource
): boolean => {
  if (a === b) return true;
  if (!a || !b) return false;
  return a === b;
};

export const resolveBoundaryParam = (resource: BoundaryResource): BoundarySetting =>
  boundarySettingFromResource(resource);

const appendQuery = (base: string, params: Record<string, string | number | undefined>): string => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || Number.isNaN(value as number)) return;
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `${base}?${query}` : base;
};

const normalizeDocId = (docId: number): number => {
  if (!isFiniteNumber(docId)) return 0;
  const normalized = Math.floor(docId);
  return normalized < 0 ? 0 : normalized;
};

export const buildBoundaryUri = (
  docId: number,
  boundary: BoundarySetting,
  options?: { imageSize?: number; imageQuality?: number }
): BoundaryUri => {
  const docSegment = normalizeDocId(docId);
  if (!boundary || boundary === 'canvas' || boundary === 'curlayer' || boundary === 'selection') {
    return appendQuery(`${RESOURCE_BASE}/${docSegment}/${boundary ?? 'canvas'}`, {
      imageSize: options?.imageSize,
      imageQuality: options?.imageQuality,
    }) as BoundaryUri;
  }

  return appendQuery(`${RESOURCE_BASE}/${docSegment}/rect`, {
    leftDistance: boundary.leftDistance,
    topDistance: boundary.topDistance,
    rightDistance: boundary.rightDistance,
    bottomDistance: boundary.bottomDistance,
    width: boundary.width,
    height: boundary.height,
    imageSize: options?.imageSize,
    imageQuality: options?.imageQuality,
  }) as BoundaryUri;
};

export const buildImageContentUri = (
  docId: number,
  content: ContentType,
  layerIdentify?: string | null
): ContentUri => {
  const docSegment = normalizeDocId(docId);
  if (content === 'curlayer') {
    return appendQuery(`${IMAGE_CONTENT_BASE}/${docSegment}/layer`, {
      layerId: layerIdentify ?? undefined,
    }) as ContentUri;
  }
  return `${IMAGE_CONTENT_BASE}/${docSegment}/${content}` as ContentUri;
};

export const buildMaskContentUri = (
  docId: number,
  content: ContentType,
  layerIdentify?: string | null,
  reverse?: boolean
): MaskUri => {
  const docSegment = normalizeDocId(docId);
  if (content === 'curlayer') {
    return appendQuery(`${MASK_CONTENT_BASE}/${docSegment}/layer`, {
      layerId: layerIdentify ?? undefined,
      reverse: reverse ? 1 : undefined,
    }) as MaskUri;
  }
  return appendQuery(`${MASK_CONTENT_BASE}/${docSegment}/${content}`, {
    reverse: reverse ? 1 : undefined,
  }) as MaskUri;
};
