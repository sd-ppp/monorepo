import { BoundaryRectSchema } from "@sdppp/common/schemas/schemas";
import type { z } from "zod";

export const UXP_PROTOCOL = "uxp:";

export const FILE_HOST = "file";
export const BOUNDARY_HOST = "boundary";
export const CONTENT_HOST = "content";
export const MASK_HOST = "mask";

export const FILE_SCHEME = `uxp://${FILE_HOST}`;
export const BOUNDARY_SCHEME = `uxp://${BOUNDARY_HOST}`;
export const CONTENT_SCHEME = `uxp://${CONTENT_HOST}`;
export const MASK_SCHEME = `uxp://${MASK_HOST}`;

export type UxpUriBrand<TName extends string> = string & { __uxpUriBrand: TName };

export type FileUri = UxpUriBrand<typeof FILE_HOST>;
export type BoundaryUri = UxpUriBrand<typeof BOUNDARY_HOST>;
export type ContentUri = UxpUriBrand<typeof CONTENT_HOST>;
export type MaskUri = UxpUriBrand<typeof MASK_HOST>;

export type BoundaryRect = z.infer<typeof BoundaryRectSchema>;
export type BoundaryPrimitive = "canvas" | "curlayer" | "selection";
export type BoundarySetting = BoundaryRect | BoundaryPrimitive | null;
export type ContentType = "canvas" | "curlayer" | "selection";

export type BoundaryResource = string | null;

export interface ParsedBoundaryResource {
  docId: number;
  boundary: BoundarySetting;
  imageSize?: number;
  imageQuality?: number;
}

export interface ParsedContentResource {
  docId: number;
  content: ContentType;
  layerIdentify?: string;
}

export interface ParsedMaskResource extends ParsedContentResource {
  reverse?: boolean;
}

const RECT_QUERY_KEYS: Array<keyof BoundaryRect> = [
  "leftDistance",
  "topDistance",
  "rightDistance",
  "bottomDistance",
  "width",
  "height"
];

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function normalizeDocId(docId: number | string | undefined | null): number {
  const numeric = Number(docId);
  if (!Number.isFinite(numeric)) return 0;
  const normalized = Math.floor(numeric);
  return normalized < 0 ? 0 : normalized;
}

function appendQuery(base: string, params: Record<string, number | string | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    searchParams.set(key, String(value));
  }
  const query = searchParams.toString();
  return query ? `${base}?${query}` : base;
}

function ensureFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
}

function parseNumberQuery(url: URL, key: string): number | undefined {
  const raw = url.searchParams.get(key);
  if (raw == null || raw === "") return undefined;
  const num = Number(raw);
  ensureFiniteNumber(num, key);
  return num;
}

function serializeBoundaryRect(rect: BoundaryRect): Record<string, number> {
  const serialized: Record<string, number> = {};
  for (const key of RECT_QUERY_KEYS) {
    serialized[key] = Number(rect[key]);
  }
  return serialized;
}

function deserializeBoundaryRect(url: URL): BoundaryRect {
  const rect: Partial<BoundaryRect> = {};
  for (const key of RECT_QUERY_KEYS) {
    const value = parseNumberQuery(url, key);
    if (value === undefined) {
      throw new Error(`boundary rect missing query parameter "${key}"`);
    }
    rect[key] = value;
  }
  return rect as BoundaryRect;
}

function extractLayerParams(layerIdentify?: string | null): { layerId?: string; layerName?: string } {
  if (!layerIdentify) return {};
  const trimmed = String(layerIdentify).trim();
  if (!trimmed) return {};

  const match = /(.*)\(id:(\d+)\)\s*$/.exec(trimmed);
  let layerId: string | undefined;
  let layerName: string | undefined;

  if (match) {
    layerName = match[1].trim().replace(/^-+/, '').trim() || undefined;
    layerId = match[2];
  } else if (/^\d+$/.test(trimmed)) {
    layerId = trimmed;
  } else {
    layerName = trimmed.replace(/^-+/, '').trim() || undefined;
  }

  return { layerId, layerName };
}

function ensureUxpUrl(uri: string, expectedHost: string) {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error(`Invalid ${expectedHost} uri: ${uri}`);
  }
  if (parsed.protocol !== UXP_PROTOCOL) {
    throw new Error(`${expectedHost} uri must use uxp:// scheme`);
  }
  if (parsed.hostname !== expectedHost) {
    throw new Error(`${expectedHost} uri host must be "${expectedHost}"`);
  }
  const [docSegment, ...rest] = parsed.pathname.split("/").filter(Boolean);
  if (!docSegment) {
    throw new Error(`${expectedHost} uri is missing required segments`);
  }
  const docId = Number(docSegment);
  ensureFiniteNumber(docId, "docId");
  if (!Number.isInteger(docId) || docId < 0) {
    throw new Error("docId must be a non-negative integer");
  }
  return { parsed, docId, segments: rest };
}

export function boundaryResourceFromSetting(boundary: BoundarySetting | undefined | null): BoundaryResource {
  if (!boundary) return null;
  if (boundary === "canvas" || boundary === "curlayer" || boundary === "selection") {
    return `${BOUNDARY_SCHEME}/${boundary}`;
  }
  const serialized = RECT_QUERY_KEYS.map((key) => {
    const value = boundary[key];
    return isFiniteNumber(value) ? value : 0;
  });
  return `${BOUNDARY_SCHEME}/rect/${serialized.join(",")}`;
}

export function parseBoundaryResource(resource: string): ParsedBoundaryResource {
  const { parsed, docId, segments } = ensureUxpUrl(resource, BOUNDARY_HOST);
  const boundaryType = segments[0];

  if (!boundaryType || boundaryType === "canvas" || boundaryType === "curlayer" || boundaryType === "selection") {
    return {
      docId,
      boundary: (boundaryType as BoundaryPrimitive) ?? "canvas",
      imageSize: parseNumberQuery(parsed, "imageSize"),
      imageQuality: parseNumberQuery(parsed, "imageQuality")
    };
  }

  if (boundaryType !== "rect") {
    throw new Error(`Unsupported boundary type "${boundaryType}"`);
  }

  return {
    docId,
    boundary: deserializeBoundaryRect(parsed),
    imageSize: parseNumberQuery(parsed, "imageSize"),
    imageQuality: parseNumberQuery(parsed, "imageQuality")
  };
}

export function parseContentResource(resource: string): ParsedContentResource {
  const { parsed, docId, segments } = ensureUxpUrl(resource, CONTENT_HOST);
  const contentType = segments[0];

  if (!contentType) {
    throw new Error("content uri is missing required segments");
  }

  if (contentType === "canvas" || contentType === "selection") {
    return {
      docId,
      content: contentType
    };
  }

  if (contentType === "curlayer") {
    return {
      docId,
      content: "curlayer",
      layerIdentify: parsed.searchParams.get("layerid") ?? undefined
    };
  }

  if (contentType === "layer") {
    const layerIdentify = parsed.searchParams.get("layerid");
    if (!layerIdentify) {
      throw new Error("content uri with /layer requires layerid query parameter");
    }
    return {
      docId,
      content: "curlayer",
      layerIdentify
    };
  }

  throw new Error(`Unsupported content type "${contentType}"`);
}

export function parseMaskResource(resource: string): ParsedMaskResource {
  const { parsed, docId, segments } = ensureUxpUrl(resource, MASK_HOST);
  const contentType = segments[0];

  if (!contentType) {
    throw new Error("mask content uri is missing required segments");
  }

  const reverseParam = parsed.searchParams.get("reverse");
  const reverse = reverseParam === "1" || reverseParam?.toLowerCase() === "true";

  if (contentType === "canvas" || contentType === "selection") {
    return { docId, content: contentType, reverse };
  }

  if (contentType === "curlayer") {
    return {
      docId,
      content: "curlayer",
      reverse,
      layerIdentify: parsed.searchParams.get("layerid") ?? undefined
    };
  }

  if (contentType === "layer") {
    const layerIdentify = parsed.searchParams.get("layerid");
    if (!layerIdentify) {
      throw new Error("mask content uri with /layer requires layerid query parameter");
    }
    return {
      docId,
      content: "curlayer",
      layerIdentify,
      reverse
    };
  }

  throw new Error(`Unsupported mask content type "${contentType}"`);
}

export function buildBoundaryUri(
  docId: number,
  boundary: BoundarySetting,
  options?: { imageSize?: number; imageQuality?: number }
): string {
  const docSegment = normalizeDocId(docId);

  if (!boundary || boundary === "canvas" || boundary === "curlayer" || boundary === "selection") {
    return appendQuery(`${BOUNDARY_SCHEME}/${docSegment}/${boundary ?? "canvas"}`, {
      imageSize: options?.imageSize,
      imageQuality: options?.imageQuality
    });
  }

  return appendQuery(`${BOUNDARY_SCHEME}/${docSegment}/rect`, {
    ...serializeBoundaryRect(boundary),
    imageSize: options?.imageSize,
    imageQuality: options?.imageQuality
  });
}

export function buildContentUri(
  docId: number,
  content: ContentType,
  layerIdentify?: string | null
): string {
  const docSegment = normalizeDocId(docId);

  if (content === "curlayer") {
    if (layerIdentify && layerIdentify !== "") {
      const { layerId, layerName } = extractLayerParams(layerIdentify);
      return appendQuery(`${CONTENT_SCHEME}/${docSegment}/layer`, {
        layerid: layerId ?? layerIdentify.trim(),
        layername: layerName ?? undefined
      });
    }
    return `${CONTENT_SCHEME}/${docSegment}/curlayer`;
  }

  return `${CONTENT_SCHEME}/${docSegment}/${content}`;
}

export function buildMaskContentUri(
  docId: number,
  content: ContentType,
  layerIdentify?: string | null,
  reverse?: boolean
): string {
  const docSegment = normalizeDocId(docId);

  if (content === "curlayer") {
    const { layerId, layerName } = extractLayerParams(layerIdentify ?? undefined);
    return appendQuery(`${MASK_SCHEME}/${docSegment}/layer`, {
      layerid: layerId ?? layerIdentify?.trim() ?? undefined,
      layername: layerName ?? undefined,
      reverse: reverse ? 1 : undefined
    });
  }

  return appendQuery(`${MASK_SCHEME}/${docSegment}/${content}`, {
    reverse: reverse ? 1 : undefined
  });
}

export function extractDocIdFromUris(
  uris: Array<string | null | undefined>
): number | null {
  for (const uri of uris) {
    if (!uri) continue;
    try {
      const parsed = new URL(uri);
      if (parsed.protocol !== UXP_PROTOCOL) continue;
      const docSegment = parsed.pathname.split("/").filter(Boolean)[0];
      if (!docSegment) continue;
      const numeric = Number(docSegment);
      if (!Number.isFinite(numeric)) continue;
      const normalized = Math.floor(numeric);
      if (normalized >= 0) {
        return normalized;
      }
    } catch {
      continue;
    }
  }
  return null;
}
