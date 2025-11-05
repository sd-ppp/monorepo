import type { BoundaryRect, BoundaryResource, BoundarySetting, ContentType } from './types';

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
