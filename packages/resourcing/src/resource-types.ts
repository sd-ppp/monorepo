import { v4 as uuidv4 } from "uuid";

export const RESOURCE_SCHEME = "uxp://";

export type ResourceType = "image" | "mask" | "file";

export type ResourceId = `${typeof RESOURCE_SCHEME}${string}`;

export interface ResourceData {
  buffer?: Uint8Array;
  mime?: string;
  path?: string;
  [key: string]: unknown;
}

export interface ResourceThumbnailCache {
  base64: string;
  width?: number;
  height?: number;
  mime?: string;
  generatedAt: number;
}

export interface ResourceEntry {
  type: ResourceType;
  data: ResourceData;
  originalMeta?: Record<string, unknown>;
  thumbnailCache?: ResourceThumbnailCache;
}

export interface ResourceListing {
  id: ResourceId;
  entry: ResourceEntry;
}

export function createResourceId(type: ResourceType, suffix?: string): ResourceId {
  const idSegment = suffix ?? uuidv4();
  return `${RESOURCE_SCHEME}${type}/${idSegment}` as ResourceId;
}

export function isResourceId(value: unknown): value is ResourceId {
  return typeof value === "string" && value.startsWith(RESOURCE_SCHEME);
}

export function assertResourceId(value: unknown, message = "Expected a uxp:// resource id"): ResourceId {
  if (!isResourceId(value)) {
    throw new TypeError(message);
  }
  return value;
}

export function getResourceType(resourceId: ResourceId): ResourceType | null {
  const segment = resourceId.slice(RESOURCE_SCHEME.length).split("/", 1)[0];
  if (segment === "image" || segment === "mask" || segment === "file") {
    return segment;
  }
  return null;
}
